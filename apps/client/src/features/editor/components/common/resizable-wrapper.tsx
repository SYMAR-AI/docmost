import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import classes from "./resizable-wrapper.module.css";

interface ResizableWrapperProps {
  children: ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onResize?: (height: number) => void;
  isEditable?: boolean;
  className?: string;
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  children,
  initialHeight = 480,
  minHeight = 200,
  maxHeight = 1200,
  onResize,
  isEditable = true,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(initialHeight);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const heightRef = useRef(initialHeight);

  useEffect(() => {
    if (!isDragging || !dragRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current || !dragRef.current) return;
      const deltaY = e.clientY - dragRef.current.startY;
      const newHeight = Math.min(
        Math.max(dragRef.current.startHeight + deltaY, minHeight),
        maxHeight,
      );
      heightRef.current = newHeight;
      setCurrentHeight(newHeight);
      wrapperRef.current.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      onResize?.(heightRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onResize, minHeight, maxHeight]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startHeight: currentHeight };
    heightRef.current = currentHeight;
    setIsDragging(true);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, [currentHeight]);

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, className, {
        [classes.resizing]: isDragging,
      })}
      style={{ height: currentHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isDragging && <div className={classes.overlay} />}
      {isEditable && (isHovered || isDragging) && (
        <div
          className={classes.resizeHandleBottom}
          onMouseDown={handleResizeStart}
        >
          <div className={classes.resizeBar} />
        </div>
      )}
    </div>
  );
};