interface KividCornerDecorProps {
  color?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { big: 52, small: 34, bigR: 8, smallR: 6, offset: 14 },
  md: { big: 64, small: 42, bigR: 14, smallR: 10, offset: 22 },
  lg: { big: 80, small: 52, bigR: 16, smallR: 12, offset: 26 },
};

const positionStyles: Record<string, React.CSSProperties> = {
  'top-left': { top: -8, left: -8 },
  'top-right': { top: -8, right: -8 },
  'bottom-left': { bottom: -8, left: -8 },
  'bottom-right': { bottom: -8, right: -8 },
};

const KividCornerDecor = ({
  color = '#E5509C',
  position = 'top-right',
  size = 'sm',
  className = '',
}: KividCornerDecorProps) => {
  const s = sizeMap[size];

  return (
    <div
      className={`absolute pointer-events-none z-0 ${className}`}
      style={positionStyles[position]}
      aria-hidden="true"
    >
      <div className="relative" style={{ width: s.big + s.offset, height: s.big + s.offset }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: s.big,
            height: s.big,
            borderRadius: s.bigR,
            backgroundColor: color,
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: s.offset,
            left: s.offset,
            width: s.small,
            height: s.small,
            borderRadius: s.smallR,
            backgroundColor: color,
            opacity: 0.07,
          }}
        />
      </div>
    </div>
  );
};

export default KividCornerDecor;
