/**
 * Shared motion presets. Only `opacity` and `transform` are animated (GPU-composited, no layout work),
 * which is what keeps lists at 60fps on mid-range phones. <MotionConfig reducedMotion="user"> in App.tsx
 * turns the transform parts off automatically for people who prefer reduced motion.
 */
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 26 } as const;

const parent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const child: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: SPRING_SOFT },
};

/** Container whose <StaggerItem/> children fade/slide in one after another. Mount it when the data is ready. */
export function Stagger({ children, ...rest }: HTMLMotionProps<"div">) {
  return <motion.div initial="hidden" animate="show" variants={parent} {...rest}>{children}</motion.div>;
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  return <motion.div variants={child} {...rest}>{children}</motion.div>;
}

/** <li> flavour for lists. */
export function StaggerLi({ children, ...rest }: HTMLMotionProps<"li">) {
  return <motion.li variants={child} {...rest}>{children}</motion.li>;
}
export function StaggerUl({ children, ...rest }: HTMLMotionProps<"ul">) {
  return <motion.ul initial="hidden" animate="show" variants={parent} {...rest}>{children}</motion.ul>;
}
