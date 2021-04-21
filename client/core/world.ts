import { EventEmitter } from 'events';

import { Coords2, Coords3, MeshType } from '../../shared';
import { SmartDictionary } from '../../shared';
import { GeneratorType } from '../libs';
import { Helper } from '../utils';

import { Chunk } from './chunk';
import { Engine } from './engine';

type WorldOptionsType = {
  maxHeight: number;
  chunkSize: number;
  dimension: number;
  generator?: GeneratorType;
  renderRadius: number;
  maxChunkPerFrame: number;
  maxBlockPerFrame: number;
};

type ServerChunkType = { x: number; z: number; meshes: { opaque: MeshType }[]; voxels: Uint8Array };

class World extends EventEmitter {
  public isReady = false;

  private camChunkName: string;
  private camChunkPos: Coords2;

  private pendingChunks: Coords2[] = [];
  private chunks: SmartDictionary<Chunk> = new SmartDictionary();
  private visibleChunks: Chunk[] = [];

  constructor(public engine: Engine, public options: WorldOptionsType) {
    super();
  }

  tick() {
    this.checkCamChunk();
    this.requestChunks();
  }

  getChunkByCPos(cCoords: Coords2) {
    return this.getChunkByName(Helper.getChunkName(cCoords));
  }

  getChunkByName(chunkName: string) {
    return this.chunks.get(chunkName);
  }

  getChunkByVoxel(vCoords: Coords3) {
    const { chunkSize } = this.options;
    const chunkCoords = Helper.mapVoxelPosToChunkPos(vCoords, chunkSize);
    return this.getChunkByCPos(chunkCoords);
  }

  getNeighborChunksByVoxel(vCoords: Coords3, padding = 0) {
    const { chunkSize } = this.options;
    const chunk = this.getChunkByVoxel(vCoords);
    const [cx, cz] = Helper.mapVoxelPosToChunkPos(vCoords, chunkSize);
    const [lx, , lz] = Helper.mapVoxelPosToChunkLocalPos(vCoords, chunkSize);
    const neighborChunks: (Chunk | null)[] = [];

    // check if local position is on the edge
    // TODO: fix this hacky way of doing so.
    const a = lx < padding;
    const b = lz < padding;
    const c = lx >= chunkSize - padding;
    const d = lz >= chunkSize - padding;

    // direct neighbors
    if (a) neighborChunks.push(this.getChunkByCPos([cx - 1, cz]));
    if (b) neighborChunks.push(this.getChunkByCPos([cx, cz - 1]));
    if (c) neighborChunks.push(this.getChunkByCPos([cx + 1, cz]));
    if (d) neighborChunks.push(this.getChunkByCPos([cx, cz + 1]));

    // side-to-side diagonals
    if (a && b) neighborChunks.push(this.getChunkByCPos([cx - 1, cz - 1]));
    if (a && d) neighborChunks.push(this.getChunkByCPos([cx - 1, cz + 1]));
    if (b && c) neighborChunks.push(this.getChunkByCPos([cx + 1, cz - 1]));
    if (c && d) neighborChunks.push(this.getChunkByCPos([cx + 1, cz + 1]));

    return neighborChunks.filter(Boolean).filter((c) => c !== chunk);
  }

  getVoxelByVoxel(vCoords: Coords3) {
    const chunk = this.getChunkByVoxel(vCoords);
    return chunk ? chunk.getVoxel(...vCoords) : null;
  }

  getVoxelByWorld(wCoords: Coords3) {
    const vCoords = Helper.mapWorldPosToVoxelPos(wCoords, this.options.dimension);
    return this.getVoxelByVoxel(vCoords);
  }

  getSolidityByVoxel(vCoords: Coords3) {
    return !!this.getVoxelByVoxel(vCoords);
  }

  getFluidityByVoxel(vCoords: Coords3) {
    // TODO
    return false;
  }

  getSolidityByWorld(wCoords: Coords3) {
    const vCoords = Helper.mapWorldPosToVoxelPos(wCoords, this.options.dimension);
    return this.getSolidityByVoxel(vCoords);
  }

  getFluidityByWorld(wCoords: Coords3) {
    const vCoords = Helper.mapWorldPosToVoxelPos(wCoords, this.options.dimension);
    return this.getFluidityByVoxel(vCoords);
  }

  handleServerChunk(serverChunk: ServerChunkType) {
    const { x: cx, z: cz } = serverChunk;
    const coords = [cx, cz] as Coords2;

    let chunk = this.getChunkByCPos(coords);

    if (!chunk) {
      const { chunkSize, dimension, maxHeight } = this.options;
      chunk = new Chunk(this.engine, coords, { size: chunkSize, dimension, maxHeight });
      this.setChunk(chunk);
    }

    chunk.setupMesh(serverChunk.meshes[0].opaque);
    chunk.voxels.data = new Uint8Array(serverChunk.voxels);
    chunk.addToScene();
  }

  setChunk(chunk: Chunk) {
    return this.chunks.set(chunk.name, chunk);
  }

  setVoxel(vCoords: Coords3, type: number) {
    // TODO
  }

  breakVoxel() {
    if (this.engine.camera.lookBlock) {
      this.setVoxel(this.engine.camera.lookBlock, 0);
    }
  }

  placeVoxel(type: number) {
    if (this.engine.camera.targetBlock) {
      this.setVoxel(this.engine.camera.targetBlock, type);
    }
  }

  addAsVisible(chunk: Chunk) {
    this.visibleChunks.push(chunk);
  }

  removeAsVisible(chunk: Chunk) {
    this.visibleChunks.splice(this.visibleChunks.indexOf(chunk), 1);
  }

  get camChunkPosStr() {
    return `${this.camChunkPos[0]} ${this.camChunkPos[1]}`;
  }

  private checkCamChunk() {
    const { chunkSize, renderRadius } = this.options;

    const pos = this.engine.camera.voxel;
    const chunkPos = Helper.mapVoxelPosToChunkPos(pos, chunkSize);
    const chunkName = Helper.getChunkName(chunkPos);

    if (chunkName !== this.camChunkName) {
      this.engine.emit('chunk-changed', chunkPos);

      this.camChunkName = chunkName;
      this.camChunkPos = chunkPos;

      this.surroundCamChunks();
    }

    let chunksLoaded = 0;
    const [cx, cz] = this.camChunkPos;
    for (let x = cx - renderRadius; x <= cx + renderRadius; x++) {
      for (let z = cz - renderRadius; z <= cz + renderRadius; z++) {
        const dx = x - cx;
        const dz = z - cz;

        // sphere of chunks around camera effect
        if (dx * dx + dz * dz > renderRadius * renderRadius) continue;

        const chunk = this.getChunkByCPos([x, z]);

        if (chunk) {
          chunksLoaded++;

          if (!chunk.isAdded) {
            chunk.addToScene();
          }
        }
      }
    }

    if (!this.isReady && chunksLoaded === this.chunks.data.length) {
      this.isReady = true;
      this.engine.emit('world-ready');
    }
  }

  private surroundCamChunks() {
    const { renderRadius, chunkSize, dimension } = this.options;

    const [cx, cz] = this.camChunkPos;

    for (let x = cx - renderRadius; x <= cx + renderRadius; x++) {
      for (let z = cz - renderRadius; z <= cz + renderRadius; z++) {
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz > renderRadius * renderRadius) continue;

        const chunk = this.getChunkByCPos([x, z]);

        if (!chunk) {
          this.pendingChunks.push([x, z]);
        }
      }
    }

    // if the chunk is too far away, remove from scene.
    const deleteDistance = renderRadius * chunkSize * 1.414;
    for (const chunk of this.visibleChunks) {
      if (chunk.distTo(...this.engine.camera.voxel) > deleteDistance) {
        chunk.removeFromScene();
      }
    }
  }

  private requestChunks() {
    // separate chunk request into frames to avoid clogging
    const { maxChunkPerFrame } = this.options;
    if (this.pendingChunks.length === 0) return;
    const framePendingChunks = this.pendingChunks.splice(0, maxChunkPerFrame);
    framePendingChunks.forEach(([cx, cz]) => {
      this.engine.network.server.sendEvent({
        type: 'LOAD',
        chunks: [{ x: cx, z: cz }],
      });
    });
  }
}

export { World, WorldOptionsType };
