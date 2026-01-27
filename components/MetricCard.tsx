import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon: LucideIcon;
  trendUp?: boolean;
  color?: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'blue' | 'gray';
}

const colorStyles = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', iconBg: 'bg-white', border: 'border-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-white', border: 'border-emerald-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', iconBg: 'bg-white', border: 'border-amber-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', iconBg: 'bg-white', border: 'border-violet-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', iconBg: 'bg-white', border: 'border-rose-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-white', border: 'border-blue-100' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', iconBg: 'bg-white', border: 'border-gray-200' },
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, trend, icon: Icon, trendUp, color = 'gray' }) => {
  const styles = colorStyles[color];

  return (
    <div className={`${styles.bg} border ${styles.border} p-6 rounded-xl hover:shadow-md transition-all duration-300 group`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${styles.iconBg} ${styles.text} shadow-sm transition-colors`}>
          <Icon size={22} />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full bg-white/60 backdrop-blur-sm ${
            trendUp ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{label}</h3>
      <p className="text-3xl font-bold text-roden-black tracking-tight">{value}</p>
    </div>
  );
};

export default MetricCard;