import { CollectionWorkflowDetail, CollectionSeed } from "@/types";
import { getMockCollectionSeeds } from "@/data/mock-workflow";

/**
 * Since we are not using a database yet, we'll use a global variable 
 * to persist our "mock" state across the development session.
 */
declare global {
  var __MINE_TALLY_STORE__: {
    collections: CollectionWorkflowDetail[];
    seeds: CollectionSeed[];
  } | undefined;
}

if (!globalThis.__MINE_TALLY_STORE__) {
  globalThis.__MINE_TALLY_STORE__ = {
    collections: [],
    seeds: getMockCollectionSeeds(),
  };
}

export const store = globalThis.__MINE_TALLY_STORE__;

export function getSeeds() {
  return store.seeds;
}

export function updateSeeds(newSeeds: CollectionSeed[]) {
  store.seeds = newSeeds;
}

export function addSeed(seed: CollectionSeed) {
  store.seeds.push(seed);
}

export function getCollections() {
  return store.collections;
}

export function setCollections(collections: CollectionWorkflowDetail[]) {
  store.collections = collections;
}
