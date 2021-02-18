import Engine from '..';

import createPhysics from 'voxel-physics-engine';

export interface IPhysicsOptions {
  gravity: [number, number, number];
  airDrag: number;
}

const physicsOptions: IPhysicsOptions = {
  gravity: [0, -10, 0],
  airDrag: 0.1,
};

/**
 * @class Physics
 * @typicalname noa.physics
 * @description Wrapper module for the physics engine. For docs see [andyhall/voxel-physics-engine](https://github.com/andyhall/voxel-physics-engine)
 */
export function makePhysics(noa: Engine, options: Partial<IPhysicsOptions>) {
  const optionsWithDefaults = {
    ...physicsOptions,
    ...options,
  };

  const world = noa.world;

  const solidLookup = noa.registry._solidityLookup;
  const fluidLookup = noa.registry._fluidityLookup;

  // physics engine runs in offset coords, so voxel getters need to match
  const offset = noa.worldOriginOffset;
  const blockGetter = (x: number, y: number, z: number) => {
    const id = world.getBlockID(x + offset[0], y + offset[1], z + offset[2]);
    return solidLookup[id];
  };
  const isFluidGetter = (x: number, y: number, z: number) => {
    const id = world.getBlockID(x + offset[0], y + offset[1], z + offset[2]);
    return fluidLookup[id];
  };

  const physics = createPhysics(optionsWithDefaults, blockGetter, isFluidGetter);

  return physics;
}