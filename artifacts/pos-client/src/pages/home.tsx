export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <main className="text-center">
        <h1 
          className="text-main font-light text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight leading-none select-none"
          style={{ color: 'var(--brand-text)' }}
          tabIndex={0}
        >
          ppointify
        </h1>
        
        {/* Subtle visual enhancement */}
        <div 
          className="mt-8 w-16 h-0.5 mx-auto opacity-30 bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ color: 'var(--brand-accent)' }}
        />
      </main>
    </div>
  );
}