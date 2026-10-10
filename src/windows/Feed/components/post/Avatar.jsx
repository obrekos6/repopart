import React, { useId } from 'react';
import { colorFromString, initialFromString } from '../../../../lib/avatar';
import './Avatar.css';

export default function Avatar({ url, name, size = 40, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const clipId = `clip-${uid}`;
  const gradId = `grad-${uid}`;

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const color = colorFromString(name);
  const letter = initialFromString(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 104 104"
      className={`avatar avatar-fallback ${className}`}
      aria-label={name}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="52" y1="0" x2="52" y2="104"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect width="104" height="104" rx="52" fill="white" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="104" height="104" rx="52" fill={color} />
        <g style={{ mixBlendMode: 'screen' }}>
          <rect
            width="104"
            height="104"
            fill={`url(#${gradId})`}
            fillOpacity="0.56"
          />
        </g>
      </g>
      <text
        x="52"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="45"
        fill="#ffffff"
        fontFamily="var(--font-nickname)"
      >
        {letter}
      </text>
    </svg>
  );
}