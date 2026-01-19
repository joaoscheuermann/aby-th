import React, { useRef } from 'react';
import { useWhiteboard } from '../hooks/useWhiteboard';
import { useNodeStore } from '../store/nodeStore';
import { ObjectInfoFooter } from './ObjectInfoFooter';
import { v4 as uuidv4 } from 'uuid';

export const WhiteboardCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook handles sync side-effects
  useWhiteboard(containerRef);

  const addNode = useNodeStore((state) => state.addNode);

  const handleAddImage = () => {
    addNode({
      id: uuidv4(),
      type: 'image',
      url: 'https://pixijs.com/assets/bunny.png',
      x: 400,
      y: 300,
      rotation: 0,
      scale: { x: 1, y: 1 },
    });
  };

  const handleAddVideo1 = () => {
    addNode({
      id: uuidv4(),
      type: 'video',
      url: 'https://pixijs.com/assets/video.mp4',
      x: 500,
      y: 400,
      rotation: 0,
      scale: { x: 1, y: 1 },
    });
  };

  const handleAddVideo2 = () => {
    addNode({
      id: uuidv4(),
      type: 'video',
      url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      x: 600,
      y: 500,
      rotation: 0,
      scale: { x: 1, y: 1 },
    });
  };

  const reset = () => {
    window.location.reload();
  };

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden bg-gray-100 p-4 gap-2">
      <div className="flex flex-row gap-1 p-4 border-2 border-black bg-white/80 z-10">
        <button onClick={handleAddImage}>Add Image</button>
        <button onClick={handleAddVideo1}>Add Video 1</button>
        <button onClick={handleAddVideo2}>Add Video 2</button>
        <button onClick={reset}>Reset</button>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full bg-gray-200"
      />

      <div className="absolute bottom-4 left-4 p-4 border-2 border-black bg-white/80 pointer-events-none">
        <p>Drag to move. Drag corners to scale. Drag top handle to rotate.</p>
      </div>

      <ObjectInfoFooter />
    </div>
  );
};
