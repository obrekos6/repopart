import React from 'react';

export const EyeIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const DownloadIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const LogoutIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const PlusIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const HeartIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const HeartFilledIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const UserIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const CameraIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Галочка «Verified» — из Figma, но переведена в currentColor
export const VerifiedIcon = ({ className, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    className={className}
    aria-label="Проверенный"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.2598 3.52099L16.9178 5.1789C17.2513 5.51234 17.7005 5.70221 18.1729 5.70221H20.5211C21.4474 5.70221 22.2069 6.40612 22.2903 7.30918L22.2996 7.48052V9.82846C22.2996 10.2962 22.4848 10.75 22.8183 11.0835L24.481 12.7414C25.1294 13.3944 25.1711 14.4224 24.6014 15.1217L24.481 15.256L22.8183 16.9186C22.4848 17.252 22.2996 17.7012 22.2996 18.1736V20.5215C22.2996 21.4477 21.5956 22.2072 20.6925 22.2906L20.5211 22.2998H18.1729C17.7005 22.2998 17.2513 22.4851 16.9178 22.8185L15.2551 24.481C14.6067 25.1294 13.5785 25.1711 12.8792 24.6014L12.7402 24.481L11.0822 22.8185C10.7487 22.4851 10.2948 22.2998 9.82705 22.2998H7.47891C6.55261 22.2998 5.79305 21.5959 5.70969 20.6929L5.70043 20.5215V18.1736C5.70043 17.7012 5.51054 17.252 5.17707 16.9186L3.51901 15.2607C2.8706 14.6077 2.82892 13.575 3.39859 12.8803L3.51901 12.7414L5.17707 11.0835C5.51054 10.75 5.70043 10.3008 5.70043 9.82846V7.48052C5.70043 6.49874 6.49704 5.70221 7.47891 5.70221H9.82705C10.2995 5.70221 10.7487 5.51234 11.0822 5.1789L12.7402 3.52099C13.435 2.82634 14.565 2.82634 15.2598 3.52099ZM18.1729 10.8612C17.7839 10.5509 17.2281 10.5833 16.8808 10.9167L16.7881 11.014L12.731 16.085L11.1378 14.4919L11.0359 14.4039C10.6515 14.1075 10.1003 14.1399 9.74832 14.4919C9.39633 14.8439 9.36391 15.395 9.66032 15.7793L9.74832 15.8812L12.1196 18.2523L12.2169 18.3403C12.6013 18.632 13.1432 18.6043 13.4952 18.2708L13.5832 18.1736L18.3258 12.2459L18.3999 12.1347C18.65 11.7179 18.562 11.1715 18.1729 10.8612Z"
      fill="currentColor"
    />
  </svg>
);