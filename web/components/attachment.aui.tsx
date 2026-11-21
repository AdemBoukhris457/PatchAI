"use client";

import {
  type PropsWithChildren,
  useState,
  type FC,
  isValidElement,
} from "react";
import {
  XIcon,
  PaperclipIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
} from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { File, getFileHref } from "@/components/file";
import { Image } from "@/components/image";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { classifyUpload } from "@/lib/content-blocks";
import { useAttachmentState } from "./attachment-state";
import { cn } from "@/lib/utils";

type AttachmentPreviewProps = {
  src: string;
  name: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src, name }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={`Preview of ${name}`}
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
        isLoaded
          ? "aui-attachment-preview-image-loaded opacity-100"
          : "aui-attachment-preview-image-loading opacity-0",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

type AttachmentPreviewDialogProps = PropsWithChildren<{
  src: string | undefined;
  name: string;
}>;

const AttachmentPreviewDialog: FC<AttachmentPreviewDialogProps> = ({
  children,
  src,
  name,
}) => {
  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        className="aui-attachment-preview-trigger cursor-zoom-in"
        render={
          isValidElement(children) ? (
            children
          ) : (
            <button type="button">{children}</button>
          )
        }
      />
      <DialogContent className="aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!">
        <DialogTitle className="aui-sr-only sr-only">
          Preview {name}
        </DialogTitle>
        <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm">
          <AttachmentPreview src={src} name={name} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC<{ src: string | undefined }> = ({ src }) => {
  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none after:hidden">
      <AvatarImage
        src={src}
        alt=""
        className="aui-attachment-tile-image rounded-none object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const {
    isComposer,
    src,
    isImage,
    name,
    typeLabel,
    isUploading,
    isError,
    errorMessage,
  } = useAttachmentState();

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root
          className={cn(
            "aui-attachment-root relative",
            isComposer &&
              "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
            isImage &&
              !isComposer &&
              "aui-attachment-root-message only:*:first:size-24",
          )}
        >
          <AttachmentPreviewDialog src={src} name={name}>
            <TooltipTrigger
              render={
                <div
                  className={cn(
                    "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 overflow-hidden rounded-[calc(var(--composer-radius,1rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-1 motion-reduce:transition-none dark:after:ring-white/10",
                    src
                      ? "cursor-zoom-in active:scale-[0.96]"
                      : "cursor-default",
                    isError &&
                      "after:ring-destructive/60 dark:after:ring-destructive/60",
                  )}
                  role={src ? "button" : "group"}
                  tabIndex={0}
                  aria-label={`${src ? `Preview ${name}` : `${typeLabel} attachment ${name}`}${
                    isError
                      ? ", upload failed"
                      : isUploading
                        ? ", uploading"
                        : ""
                  }`}
                />
              }
            >
              <AttachmentThumb src={src} />
              {isUploading && (
                <div
                  aria-hidden="true"
                  className="aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
                >
                  <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
                </div>
              )}
              {isError && (
                <div
                  aria-hidden="true"
                  className="aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
                >
                  <AlertCircleIcon className="text-destructive size-4" />
                </div>
              )}
            </TooltipTrigger>
          </AttachmentPreviewDialog>
          {isComposer && <AttachmentRemove name={name} />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
          {errorMessage && (
            <p className="aui-attachment-error-message">{errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AttachmentRemove: FC<{ name: string }> = ({ name }) => {
  return (
    <AttachmentPrimitive.Remove
      render={
        <TooltipIconButton
          tooltip={`Remove ${name}`}
          className="aui-attachment-tile-remove absolute end-1 top-1 size-5 rounded-full bg-black/50! text-white after:absolute after:-inset-1.5 hover:bg-black/70! hover:text-white! active:scale-[0.96] motion-reduce:transition-none"
          side="top"
        />
      }
    >
      <XIcon className="aui-attachment-remove-icon size-3 stroke-[2.5]" />
    </AttachmentPrimitive.Remove>
  );
};

const MessageAttachment: FC = () => {
  const name = useAuiState((s) => s.attachment.name);
  const contentType = useAuiState((s) => s.attachment.contentType);
  const part = useAuiState((s) =>
    s.attachment.status.type === "complete"
      ? s.attachment.content?.[0]
      : undefined,
  );

  if (!part) return <AttachmentUI />;

  const filename =
    "filename" in part && typeof part.filename === "string"
      ? part.filename
      : name;

  if (part.type === "image" && part.image) {
    return (
      <div className="w-full max-w-96">
        <Image
          type="image"
          image={part.image}
          filename={filename}
          status={{ type: "complete" }}
        />
      </div>
    );
  }

  if (part.type !== "file" || !part.data) {
    return <AttachmentUI />;
  }

  const declared =
    part.mimeType || contentType || "application/octet-stream";
  const media = classifyUpload(filename, declared);
  const mimeType = media?.mime ?? declared;

  if (media?.kind === "image") {
    const image = getFileHref(part.data, mimeType, part.sourceType);
    if (!image) return <AttachmentUI />;
    return (
      <div className="w-full max-w-96">
        <Image
          type="image"
          image={image}
          filename={filename}
          status={{ type: "complete" }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        media?.kind === "audio" || media?.kind === "video"
          ? "w-full max-w-xl"
          : "w-fit max-w-sm",
      )}
    >
      <File
        type="file"
        data={part.data}
        mimeType={mimeType}
        filename={filename}
        {...(part.sourceType !== undefined && {
          sourceType: part.sourceType,
        })}
        status={{ type: "complete" }}
      />
    </div>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-col items-end gap-2 empty:hidden">
      <MessagePrimitive.Attachments>
        {() => <MessageAttachment />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment
      render={
        <TooltipIconButton
          tooltip="Attach"
          side="bottom"
          variant="ghost"
          size="icon"
          className="aui-composer-add-attachment text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-8 rounded-full active:scale-[0.96] motion-reduce:transition-none"
          aria-label="Attach"
        />
      }
    >
      <PaperclipIcon className="aui-attachment-add-icon size-4" />
    </ComposerPrimitive.AddAttachment>
  );
};
