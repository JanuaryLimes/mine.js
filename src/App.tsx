import { useEffect, useRef } from "react";
import { Engine } from "./upstream/core";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const domElement = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (domElement.current) {
      const engine = new Engine("1", {
        //@ts-ignore // TODO
        container: { domElement: domElement.current },
      });
      engine.start();
    }
  }, [domElement]);
  return <div ref={domElement}></div>;
}

export default App;
