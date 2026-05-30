"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

type PageShellProps = {
  children: ReactNode;
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function PageShell({ children }: PageShellProps) {
  const pathname = usePathname();

  return (
    <motion.section
      key={pathname}
      layout
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      {children}
    </motion.section>
  );
}
