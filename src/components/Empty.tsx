import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  text?: string;
  hint?: string;
  className?: string;
}

export default function Empty({
  text = '暂无数据',
  hint,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-10 text-center',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-4">
        <Inbox size={32} />
      </div>
      <p className="text-base text-slate-600 font-medium">{text}</p>
      {hint && (
        <p className="text-sm text-slate-400 mt-2 max-w-md">{hint}</p>
      )}
    </div>
  );
}
