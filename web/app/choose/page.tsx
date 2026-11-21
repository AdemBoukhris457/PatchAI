import type { Metadata } from "next"

import { Gallery } from "@/components/choose/gallery"

export const metadata: Metadata = {
  title: "Pick an input",
  description: "A temporary page for choosing a composer.",
}

export default function ChoosePage() {
  return <Gallery />
}
