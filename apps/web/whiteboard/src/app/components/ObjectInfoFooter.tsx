import React, { useEffect, useRef, useState } from 'react';
import { useWhiteboardStore } from '../store/whiteboardStore';

export const ObjectInfoFooter: React.FC = () => {
  const selectedObject = useWhiteboardStore((state) => state.selectedObject);
  const [info, setInfo] = useState<{
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedObject) {
      setInfo(null);
      return;
    }

    const update = () => {
      if (selectedObject && !selectedObject.destroyed) {
        setInfo({
          x: Math.round(selectedObject.x),
          y: Math.round(selectedObject.y),
          rotation: parseFloat(selectedObject.rotation.toFixed(2)),
          scaleX: parseFloat(selectedObject.scale.x.toFixed(2)),
          scaleY: parseFloat(selectedObject.scale.y.toFixed(2)),
        });
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedObject]);

  if (!info) return null;

  return (
    <div className="absolute bottom-4 right-4 p-4 border-2 border-black bg-white/90 shadow-lg flex flex-col gap-2 font-mono text-sm pointer-events-none">
      <h3 className="font-bold border-b border-black pb-1">Object Info</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>X: {info.x}</span>
        <span>Y: {info.y}</span>
        <span>Rot: {info.rotation}</span>
        <span></span>
        <span>Scale X: {info.scaleX}</span>
        <span>Scale Y: {info.scaleY}</span>
      </div>
    </div>
  );
};
