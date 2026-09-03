import { useMemo } from 'react';

const COLORS = [
  'bg-primary',
  'bg-secondary',
  'bg-accent',
  'bg-primary/70',
  'bg-secondary/70',
];

const ConfettiCanvas = () => {
  const confetti = useMemo(
    () =>
      Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2.5 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rotation: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {confetti.map((c) => (
        <div
          key={c.id}
          className={`absolute rounded-sm animate-confetti-fall ${c.color}`}
          style={{
            left: `${c.left}%`,
            top: -10,
            width: c.size,
            height: c.size * 0.6,
            '--duration': `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            transform: `rotate(${c.rotation}deg)`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default ConfettiCanvas;
