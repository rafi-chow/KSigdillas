export function CheeseDrip({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 120"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        fill="currentColor"
        d="M0 0h1440v43c-78 8-137 26-220 20-98-8-147-37-253-28-109 10-133 51-240 46-81-4-114-35-196-31-91 4-132 45-224 45C188 95 98 54 0 69V0Z"
      />
      <path
        fill="currentColor"
        d="M310 70c0-19 15-34 34-34s34 15 34 34v25c0 13-10 23-23 23s-23-10-23-23v-8c0-5-4-9-9-9h-13v-8ZM1152 55c0-16 13-29 29-29s29 13 29 29v18c0 10-8 18-18 18s-18-8-18-18v-5c0-5-4-9-9-9h-13v-4Z"
      />
    </svg>
  );
}

export function QuesadillaArt() {
  return (
    <div className="quesadilla-art" aria-hidden="true">
      <div className="sunburst" />
      <svg viewBox="0 0 500 430" role="presentation">
        <g className="float-chip chip-one">
          <path d="M80 105 141 69l9 78-70-42Z" fill="#F8B932" stroke="#171412" strokeWidth="7" />
          <circle cx="120" cy="104" r="5" fill="#A31D24" />
        </g>
        <g className="float-chip chip-two">
          <path d="m407 287 48 27-48 31v-58Z" fill="#F9CD56" stroke="#171412" strokeWidth="7" />
          <circle cx="426" cy="315" r="5" fill="#A31D24" />
        </g>
        <path d="M102 280c22-98 104-174 216-180 35 47 56 105 58 166L102 280Z" fill="#F5A623" stroke="#171412" strokeWidth="9" strokeLinejoin="round" />
        <path d="M114 263c27-76 92-132 185-143 23 35 40 76 48 122l-233 21Z" fill="#F9D160" />
        <path d="m106 280 273-20c11 0 18 10 13 20-27 49-80 83-142 84-60 2-113-28-144-84Z" fill="#E78719" stroke="#171412" strokeWidth="9" strokeLinejoin="round" />
        <path d="M145 284c30 31 67 46 111 45 44-1 78-16 101-43" stroke="#FFD95F" strokeWidth="22" strokeLinecap="round" />
        <path d="M219 334c4 30 21 35 28 5M296 325c8 24 24 23 31-6" stroke="#FFD95F" strokeWidth="13" strokeLinecap="round" />
        <g fill="#A31D24">
          <circle cx="194" cy="192" r="9" />
          <circle cx="279" cy="170" r="8" />
          <circle cx="314" cy="222" r="7" />
        </g>
        <g fill="#5A8E3B">
          <path d="m160 232 16-18 17 16-18 15Z" />
          <path d="m246 217 16-18 17 16-18 15Z" />
        </g>
        <path d="M63 199c-20-9-28-22-31-39M75 177c-4-21 0-35 12-48M400 182c20-9 29-22 33-39M392 158c4-21 0-35-12-48" stroke="#171412" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
