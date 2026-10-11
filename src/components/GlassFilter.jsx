import React from 'react';

export default function GlassFilter() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Figma Glass: refraction=1, depth=16, splay=0.06, dispersion=0 */}
        <filter
          id="liquid-glass"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          filterUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          {/* Шум для «жидкой» неровности стекла */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.012"
            numOctaves="2"
            seed="92"
            result="noise"
          />
          {/* splay: 0.06 → мягкое размытие шума, чтобы преломление не было «дырявым» */}
          <feGaussianBlur in="noise" stdDeviation="1.4" result="softNoise" />
          {/* refraction: 1 + depth: 16 → общий scale смещения */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="32"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}