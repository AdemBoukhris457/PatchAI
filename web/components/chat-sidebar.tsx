"use client"

import { SquarePenIcon, Trash2Icon } from "lucide-react"

import type { StoredChat } from "@/lib/chats"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function ChatSidebar({
  chats,
  activeId,
  query,
  ready,
  onQueryChange,
  onNewChat,
  onSelect,
  onDelete,
}: {
  chats: StoredChat[]
  activeId: string | null
  query: string
  ready: boolean
  onQueryChange: (value: string) => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { state } = useSidebar()
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? chats.filter((chat) => chat.title.toLowerCase().includes(needle))
    : chats

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New chat" onClick={onNewChat}>
              <SquarePenIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {state === "expanded" ? (
          <SidebarInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recents</SidebarGroupLabel>
          <SidebarGroupContent>
            {shown.length === 0 && ready ? (
              <p className="px-2 text-sm text-muted-foreground">
                No chats found.
              </p>
            ) : (
              <SidebarMenu>
                {shown.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      isActive={chat.id === activeId}
                      tooltip={chat.title}
                      aria-current={chat.id === activeId ? "page" : undefined}
                      onClick={() => onSelect(chat.id)}
                    >
                      <span>{chat.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      aria-label={`Delete ${chat.title}`}
                      onClick={() => onDelete(chat.id)}
                    >
                      <Trash2Icon />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
