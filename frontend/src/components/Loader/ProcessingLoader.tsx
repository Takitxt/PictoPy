import { useEffect, useState } from 'react';

// Pixel wavefront: the 650ms cycle is shorter than the sweep, so two fronts are always in flight.
const DELAYS = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return (col + Math.abs(row - 1)) * 90;
});

const useElapsed = (): string => {
  const [tenths, setTenths] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTenths((t) => t + 1), 100);
    return () => clearInterval(timer);
  }, []);
  const seconds = tenths / 10;
  return seconds < 60
    ? `${seconds.toFixed(1)}s`
    : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
};

export const ProcessingLoader: React.FC<{ label?: string }> = ({
  label = 'Processing',
}) => {
  const elapsed = useElapsed();

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid grid-cols-[repeat(3,4px)] gap-[1.5px]"
      >
        {DELAYS.map((delay, index) => (
          <span
            key={index}
            className="bg-foreground size-[4px] rounded-[1px]"
            style={{
              opacity: 0.15,
              animation: `pixel-on 650ms ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </span>
      <span
        className="bg-clip-text text-[13px] font-medium text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-text 1.4s linear infinite',
        }}
      >
        {label}
      </span>
      <span className="text-muted-foreground font-mono text-[12px] tabular-nums">
        {elapsed}
      </span>
    </span>
  );
};
