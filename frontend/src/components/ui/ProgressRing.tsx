interface ProgressRingProps {
  size?: number;
  stroke?: number;
  value: number; // 0-100
  trackColor?: string;
  color?: string;
}

export const ProgressRing = ({ size = 80, stroke = 8, value, trackColor = '#1f2937', color = '#60a5fa' }: ProgressRingProps) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        stroke={trackColor}
        fill="transparent"
        strokeWidth={stroke}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        opacity={0.4}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        className="transition-all duration-500"
      />
    </svg>
  );
};
