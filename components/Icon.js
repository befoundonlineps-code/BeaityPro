const PATHS = {
  clients: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  appointments: 'M4 5h16v16H4V5zM4 9h16M8 3v4M16 3v4M8 13h3M8 17h6',
  calls: 'M6 3l3 1 1 3-2 2c1 3 3 5 6 6l2-2 3 1v3c0 1-1 2-2 2C10 19 5 14 4 5c0-1 1-2 2-2z',
  products: 'M4 8l8-4 8 4-8 4-8-4zM4 8v9l8 4M20 8v9l-8 4M12 12v9',
  services: 'M8 5l1.5 3.5L13 10l-3.5 1.5L8 15l-1.5-3.5L3 10l3.5-1.5L8 5zM17 13l1 2.3L20.3 16l-2.3 1-1 2.3-1-2.3L13.7 16l2.3-.7 1-2.3z',
  groups: 'M9 12a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 8a3 3 0 110-6M15 14c2.8.3 5 2.7 5 6h-4',
  marketing: 'M3 10v4h4l6 4V6l-6 4H3zM16 9c1.2.8 2 2.2 2 3.7s-.8 2.9-2 3.7M19 6c2 1.4 3.3 3.7 3.3 6.3S21 17.8 19 19.2',
  employees: 'M4 4h16v16H4V4zM8 4v16M12 9h5M12 13h5M9.5 6.5h-3v2h3v-2z',
  salary: 'M3 7h18v10H3V7zM3 7l4-3h10l4 3M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  documents: 'M7 3h7l4 4v14H7V3zM14 3v4h4M9.5 12h5M9.5 15.5h5M9.5 8.5h2',
  cash: 'M3 6h18v13H3V6zM3 6l9 6 9-6M7 15.5h.01M17 15.5h.01M11 15a1 1 0 102 0 1 1 0 00-2 0z',
  reports: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7',
  settings: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.6a7 7 0 00-2-1.2L14 3h-4l-.5 2.2a7 7 0 00-2 1.2l-2.4-.6-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-.6a7 7 0 002 1.2L10 21h4l.5-2.2a7 7 0 002-1.2l2.4.6 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z',
}

export default function Icon({ name, size = 20 }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
