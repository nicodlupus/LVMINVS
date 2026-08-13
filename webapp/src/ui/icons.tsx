import type { SVGProps, ReactNode } from "react";

interface IcProps extends Omit<SVGProps<SVGSVGElement>, "d"> {
  d?: string;
  size?: number;
  sw?: number | string;
  children?: ReactNode;
}
export const Ic = ({ d, size = 22, fill = "none", sw = 1.6, children, ...rest }: IcProps) => (
  <svg {...rest} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);
export type IconProps = Omit<IcProps, "d" | "children">;

export const IconMenu   = (p: IconProps) => <Ic {...p}><path d="M4 7h16"/><path d="M4 12h11"/><path d="M4 17h16"/></Ic>;
export const IconBack   = (p: IconProps) => <Ic {...p} d="M15 5l-7 7 7 7" />;
export const IconClose  = (p: IconProps) => <Ic {...p}><path d="M6 6l12 12"/><path d="M18 6L6 18"/></Ic>;
export const IconMic    = (p: IconProps) => <Ic {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></Ic>;
export const IconSend   = (p: IconProps) => <Ic {...p}><path d="M4 12l16-8-6 8 6 8z"/></Ic>;
export const IconPlay   = (p: IconProps) => <Ic {...p} fill="currentColor" sw="0"><path d="M8 5.5v13l11-6.5z"/></Ic>;
export const IconPause  = (p: IconProps) => <Ic {...p} fill="currentColor" sw="0"><rect x="7" y="5" width="4" height="14" rx="1.2"/><rect x="13" y="5" width="4" height="14" rx="1.2"/></Ic>;
export const IconStop   = (p: IconProps) => <Ic {...p} fill="currentColor" sw="0"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></Ic>;
export const IconHome   = (p: IconProps) => <Ic {...p}><path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></Ic>;
export const IconMap    = (p: IconProps) => <Ic {...p}><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="6" cy="19" r="2"/><path d="M9.6 10.4L6.6 7.4M14.6 10.6l3-2.2M10 14.3l-2.6 3.1"/></Ic>;
export const IconSpark  = (p: IconProps) => <Ic {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></Ic>;
export const IconUser   = (p: IconProps) => <Ic {...p}><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></Ic>;
export const IconPlus   = (p: IconProps) => <Ic {...p}><path d="M12 5v14"/><path d="M5 12h14"/></Ic>;
export const IconCheck  = (p: IconProps) => <Ic {...p} d="M5 12.5l4.5 4.5L19 7" />;
export const IconChev   = (p: IconProps) => <Ic {...p} d="M9 5l7 7-7 7" />;
export const IconPen    = (p: IconProps) => <Ic {...p}><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/></Ic>;
export const IconTrash  = (p: IconProps) => <Ic {...p}><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></Ic>;
export const IconFilter = (p: IconProps) => <Ic {...p}><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></Ic>;
export const IconWave   = (p: IconProps) => <Ic {...p}><path d="M4 11v2M8 7v10M12 4v16M16 8v8M20 11v2"/></Ic>;
export const IconStar   = (p: IconProps) => <Ic {...p}><path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.6l-5.1 2.7.98-5.68-4.13-4.02 5.7-.83z"/></Ic>;
