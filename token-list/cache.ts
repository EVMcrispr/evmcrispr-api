const MAX_KV_VALUE_SIZE = 60 * 1024; // 60KiB, leaving some buffer from 65536 bytes

// Helper to reassemble chunks
async function reassembleChunks(kv: Deno.Kv, chunkKeyFn: (index: number) => Deno.KvKey, numChunks: number, url: string): Promise<any | null> {
  console.log(`[CACHE] Attempting to reassemble ${numChunks} chunks for ${url}`);
  let combinedJsonString = "";
  const chunkPromises: Promise<Deno.KvEntryMaybe<string>>[] = [];
  for (let i = 0; i < numChunks; i++) {
    chunkPromises.push(kv.get<string>(chunkKeyFn(i)));
  }

  try {
    const chunkResults = await Promise.all(chunkPromises);
    for (let i = 0; i < chunkResults.length; i++) {
      const result = chunkResults[i];
      if (result.value === null || result.versionstamp === null) { // Check versionstamp to ensure entry exists
        console.error(`[CACHE] Missing chunk #${i} for ${url} during reassembly.`);
        return null; // Indicates corruption or incomplete cache
      }
      combinedJsonString += result.value;
    }
    return JSON.parse(combinedJsonString);
  } catch (e) {
    console.error(`[CACHE] Error reassembling or parsing chunks for ${url}: ${e.message}`);
    return null; // Indicates corruption
  }
}

export async function fetchWithCache(
  kv: Deno.Kv,
  url: string,
  cacheKeyPrefix = "url_cache_v1",
  cacheTTLMilliseconds = 5 * 60 * 1000
) {
  const baseKeyArray = [cacheKeyPrefix, url];
  const metaKey = [...baseKeyArray, "_meta"]; // Key for metadata
  const chunkKeyPrefix = [...baseKeyArray, "_chunk"]; // Prefix for data chunks
  const chunkKeyFn = (index: number) => [...chunkKeyPrefix, index] as Deno.KvKey;

  // To store information about stale data for potential fallback
  let staleDataInfo: {
    type: 'direct' | 'chunked';
    data?: any; // For direct types
    numChunks?: number; // For chunked type
    timestamp: number;
  } | null = null;

  // 1. Try to get data using the "_meta" key convention
  const metaEntry = await kv.get<{
    timestamp: number;
    isChunked: boolean;
    numChunks?: number; // Only if isChunked is true
    directData?: any;   // Only if isChunked is false
  }>(metaKey);

  if (metaEntry.value !== null && metaEntry.versionstamp !== null) {
    const { timestamp, isChunked, numChunks, directData } = metaEntry.value;
    const now = Date.now();
    const age = now - timestamp;

    if (age < cacheTTLMilliseconds) {
      console.log(`[CACHE] Found FRESH _meta data (age: ${age / 1000}s) for ${url}.`);
      if (isChunked && numChunks !== undefined) {
        const reassembledData = await reassembleChunks(kv, chunkKeyFn, numChunks, url);
        if (reassembledData !== null) {
          console.log(`[CACHE] Successfully reassembled FRESH chunked data for ${url}.`);
          return reassembledData;
        }
        console.warn(`[CACHE] Failed to reassemble FRESH chunked data for ${url}. Will fetch.`);
      } else if (!isChunked && directData !== undefined) {
        console.log(`[CACHE] Returning FRESH direct data for ${url}.`);
        return directData;
      } else {
        console.warn(`[CACHE] Inconsistent FRESH _meta data for ${url}. Will fetch.`);
      }
    } else { // Stale _meta data
      console.log(`[CACHE] Found STALE _meta data (age: ${age / 1000}s) for ${url}.`);
      if (isChunked && numChunks !== undefined) {
        staleDataInfo = { type: 'chunked', numChunks, timestamp };
      } else if (!isChunked && directData !== undefined) {
        staleDataInfo = { type: 'direct', data: directData, timestamp };
      }
    }
  }

  // 3. If cache was not fresh, not found, or reassembly failed, attempt to fetch new data
  try {
    console.log(`[FETCH] Attempting to fetch ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}. Status: ${response.statusText}`);
    }
    const newData = await response.json();
    console.log(`[FETCH] Successfully fetched ${url}.`);

    // --- Clear old cache entries before writing new ones ---
    // Use an atomic operation for deletions if possible, or individual deletes.
    // For simplicity and to handle potentially many chunks, we'll do individual deletes.
    console.log(`[CACHE] Clearing previous cache entries for ${url} before update...`);
    const deletePromises: Promise<void>[] = [];

    // Delete the _meta key if it existed
    if (metaEntry.value !== null) {
        deletePromises.push(kv.delete(metaKey));
        // If the old meta indicated chunking, delete those chunks
        if (metaEntry.value.isChunked && metaEntry.value.numChunks) {
            for (let i = 0; i < metaEntry.value.numChunks; i++) {
                deletePromises.push(kv.delete(chunkKeyFn(i)));
            }
        }
    }
    
    // Always try to delete the baseKeyArray in case it was an old cache not caught by staleDataInfo
    deletePromises.push(kv.delete(baseKeyArray));
    await Promise.all(deletePromises);
    console.log(`[CACHE] Finished clearing previous cache entries for ${url}.`);
    // --- Finished clearing old cache entries ---


    const jsonDataString = JSON.stringify(newData);
    // Use byteLength for accurate size, TextEncoder().encode().length
    const dataSize = new TextEncoder().encode(jsonDataString).length;

    if (dataSize < MAX_KV_VALUE_SIZE) {
      // Store directly under _meta key
      await kv.set(metaKey, { timestamp: Date.now(), isChunked: false, directData: newData });
      console.log(`[CACHE] Stored data directly for ${url} (size: ${dataSize} bytes).`);
    } else {
      // Store as chunks
      const chunks: string[] = [];
      for (let i = 0; i < jsonDataString.length; i += MAX_KV_VALUE_SIZE) {
        chunks.push(jsonDataString.substring(i, i + MAX_KV_VALUE_SIZE));
      }
      console.log(`[CACHE] Data for ${url} is large (size: ${dataSize} bytes). Storing in ${chunks.length} chunks.`);

      // Set meta entry first
      await kv.set(metaKey, { timestamp: Date.now(), isChunked: true, numChunks: chunks.length });

      // Set all chunks. If any of these fail, the cache might be in an inconsistent state.
      // Consider using kv.atomic() if the number of chunks is small (<=10 operations total including meta).
      // For more chunks, Promise.all is reasonable.
      const chunkSetPromises: Promise<Deno.KvCommitResult>[] = [];
      for (let i = 0; i < chunks.length; i++) {
        chunkSetPromises.push(kv.set(chunkKeyFn(i), chunks[i]));
      }
      await Promise.all(chunkSetPromises);
      console.log(`[CACHE] Successfully stored ${chunks.length} chunks for ${url}.`);
    }
    return newData; // Return fresh data

  } catch (fetchError) {
    console.error(`[FETCH] Failed to fetch ${url}: ${fetchError.message}`);
    if (staleDataInfo) {
      console.warn(`[CACHE] Using STALE data for ${url} due to fetch failure (timestamp: ${new Date(staleDataInfo.timestamp).toISOString()}).`);
      if (staleDataInfo.type === 'chunked' && staleDataInfo.numChunks !== undefined) {
        const reassembledStaleData = await reassembleChunks(kv, chunkKeyFn, staleDataInfo.numChunks, url);
        if (reassembledStaleData !== null) {
          return reassembledStaleData;
        }
        console.error(`[CACHE] Failed to reassemble STALE chunked data for ${url}.`);
      } else if ((staleDataInfo.type === 'direct') && staleDataInfo.data !== undefined) {
        return staleDataInfo.data;
      }
    }
    // If fetch fails AND there's no usable stale data (or reassembly failed)
    throw new Error(`Failed to fetch ${url} and no/corrupt cache available: ${fetchError.message}`);
  }
}
