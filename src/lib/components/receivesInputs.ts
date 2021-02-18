import Engine from '../..';

import { IComponentType } from './componentType';

/**
 * Input processing component - gets (key) input state and
 * applies it to receiving entities by updating their movement
 * component state (heading, movespeed, jumping, etc.)
 */
export function receivesInputs(noa: Engine): IComponentType {
  return {
    name: 'receivesInputs',
    order: 20,
    state: {},
    system(dt, states) {
      const ents = noa.entities;
      const inputState = noa.inputs.state;
      const camHeading = noa.camera.heading;

      states.forEach((state) => {
        const moveState = ents.getMovement(state.__id);
        setMovementState(moveState, inputState, camHeading);
      });
    },
  };
}

function setMovementState(state: any, inputs: any, camHeading: number) {
  state.jumping = !!inputs.jump;

  const fb = inputs.forward ? (inputs.backward ? 0 : 1) : inputs.backward ? -1 : 0;
  const rl = inputs.right ? (inputs.left ? 0 : 1) : inputs.left ? -1 : 0;

  if ((fb | rl) === 0) {
    state.running = false;
  } else {
    state.running = true;
    if (fb) {
      if (fb == -1) camHeading += Math.PI;
      if (rl) {
        camHeading += (Math.PI / 4) * fb * rl; // didn't plan this but it works!
      }
    } else {
      camHeading += (rl * Math.PI) / 2;
    }
    state.heading = camHeading;
  }
}