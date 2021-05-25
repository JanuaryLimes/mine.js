import { useEffect, useRef } from "react";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const domElement = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (domElement.current) {
    }
  }, [domElement]);
  return <div style={{ width: 700, height: 500 }} ref={domElement}></div>;
}

export default App;
