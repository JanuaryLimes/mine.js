import { useEffect, useRef } from "react";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (canvasRef.current) {
      //
    }
  }, [canvasRef]);
  return (
    <div>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}

export default App;
