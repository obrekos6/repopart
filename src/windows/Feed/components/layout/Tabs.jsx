import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function Tabs({ tabs, active, onChange }) {
  const containerRef = useRef(null);
  const [capsule, setCapsule] = useState({ left: 0, width: 0 });
  const [dragging, setDragging] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);

  const dragActiveRef = useRef(false);
  const skipClickRef = useRef(false);
  const stateRef = useRef({
    startX: 0,
    startLeft: 0,
    currentLeft: 0,
    moved: false,
    positions: [],
    capsuleWidth: 0,
    active,
    onChange,
  });

  stateRef.current.active = active;
  stateRef.current.onChange = onChange;
  stateRef.current.capsuleWidth = capsule.width;

  const collectPositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll('.tab')).map((btn) => ({
      id: btn.dataset.tabId,
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      center: btn.offsetLeft + btn.offsetWidth / 2,
    }));
  }, []);

  const snapCapsuleTo = useCallback((positions, tabId) => {
    const btn = positions.find((p) => p.id === tabId);
    if (btn) setCapsule({ left: btn.left, width: btn.width });
  }, []);

  useEffect(() => {
    const positions = collectPositions();
    stateRef.current.positions = positions;
    snapCapsuleTo(positions, active);
  }, [active, tabs, collectPositions, snapCapsuleTo]);

  useEffect(() => {
    const onResize = () => {
      const positions = collectPositions();
      stateRef.current.positions = positions;
      snapCapsuleTo(positions, stateRef.current.active);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collectPositions, snapCapsuleTo]);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const positions = collectPositions();
    stateRef.current.positions = positions;
    stateRef.current.startX = e.clientX;
    stateRef.current.startLeft = capsule.left;
    stateRef.current.currentLeft = capsule.left;
    stateRef.current.moved = false;
    dragActiveRef.current = true;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      if (!dragActiveRef.current) return;
      const dx = e.clientX - stateRef.current.startX;
      if (Math.abs(dx) > 5) stateRef.current.moved = true;

      const positions = stateRef.current.positions;
      if (positions.length === 0) return;

      let newLeft = stateRef.current.startLeft + dx;
      const minLeft = positions[0].left;
      const maxLeft = positions[positions.length - 1].left;
      if (newLeft < minLeft) newLeft = minLeft;
      if (newLeft > maxLeft) newLeft = maxLeft;

      stateRef.current.currentLeft = newLeft;
      setCapsule((prev) => ({ ...prev, left: newLeft }));

      const center = newLeft + stateRef.current.capsuleWidth / 2;
      let nearest = positions[0];
      let minDist = Math.abs(center - nearest.center);
      for (const p of positions) {
        const dist = Math.abs(center - p.center);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      setHoveredTab(nearest.id);
    };

    const onUp = () => {
      dragActiveRef.current = false;
      setDragging(false);

      const positions = stateRef.current.positions;

      if (!stateRef.current.moved) {
        setHoveredTab(null);
        if (positions.length) snapCapsuleTo(positions, stateRef.current.active);
        return;
      }

      skipClickRef.current = true;
      setTimeout(() => { skipClickRef.current = false; }, 80);

      if (positions.length === 0) {
        setHoveredTab(null);
        return;
      }

      const center = stateRef.current.currentLeft + stateRef.current.capsuleWidth / 2;
      let nearest = positions[0];
      let minDist = Math.abs(center - nearest.center);
      for (const p of positions) {
        const dist = Math.abs(center - p.center);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }

      setHoveredTab(null);
      snapCapsuleTo(positions, nearest.id);

      if (nearest.id !== stateRef.current.active) {
        stateRef.current.onChange(nearest.id);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, snapCapsuleTo]);

  const handleClick = (tabId) => {
    if (skipClickRef.current) return;
    if (dragActiveRef.current) return;
    onChange(tabId);
  };

  return (
    <div className="tabs" ref={containerRef} onPointerDown={handlePointerDown}>
      <div
        className={`tabs-capsule ${dragging ? 'is-dragging' : ''}`}
        style={{
          left: `${capsule.left}px`,
          width: `${capsule.width}px`,
          transform: `scale(${dragging ? 1.08 : 1})`,
        }}
      />
      {tabs.map((t) => {
        const isVisualActive = dragging ? hoveredTab === t.id : active === t.id;
        return (
          <button
            key={t.id}
            data-tab-id={t.id}
            className={`tab ${isVisualActive ? 'is-active' : ''}`}
            onClick={() => handleClick(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}