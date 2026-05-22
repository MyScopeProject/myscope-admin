"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import { useAuth } from "@/contexts/auth-context"
import toast from "react-hot-toast"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Link as LinkIcon,
  Loader,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

interface PastEvent {
  id: string
  image_url: string
  title: string | null
  link_url: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type FormState = {
  image_url: string
  title: string
  link_url: string
}

const emptyForm = (): FormState => ({ image_url: "", title: "", link_url: "" })

export default function PastEventsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<PastEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.listPastEvents()
      setItems(res.data?.data?.items || [])
    } catch {
      toast.error("Failed to load past events")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const openCreate = () => {
    setForm(emptyForm())
    setEditing("new")
  }

  const openEdit = (it: PastEvent) => {
    setForm({
      image_url: it.image_url ?? "",
      title: it.title ?? "",
      link_url: it.link_url ?? "",
    })
    setEditing(it.id)
  }

  const closeEditor = () => {
    setEditing(null)
    setForm(emptyForm())
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.")
      return
    }
    setUploading(true)
    try {
      const res = await adminAPI.uploadPastEventImage(file)
      const url = res.data?.data?.url
      if (!url) throw new Error("No URL returned")
      setForm((f) => ({ ...f, image_url: url }))
      toast.success("Image uploaded")
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.image_url) {
      toast.error("Upload an image first.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        image_url: form.image_url,
        title: form.title.trim() || null,
        link_url: form.link_url.trim() || null,
      }
      if (editing === "new") {
        await adminAPI.createPastEvent(payload)
        toast.success("Past event added")
      } else if (editing) {
        await adminAPI.updatePastEvent(editing, payload)
        toast.success("Past event updated")
      }
      await fetchItems()
      closeEditor()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (it: PastEvent) => {
    setBusyId(it.id)
    try {
      await adminAPI.updatePastEvent(it.id, { active: !it.active })
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, active: !it.active } : x)))
    } catch {
      toast.error("Failed to toggle")
    } finally {
      setBusyId(null)
    }
  }

  const move = async (it: PastEvent, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === it.id)
    const target = idx + direction
    if (target < 0 || target >= sorted.length) return
    const other = sorted[target]
    setBusyId(it.id)
    try {
      await Promise.all([
        adminAPI.updatePastEvent(it.id, { sort_order: other.sort_order }),
        adminAPI.updatePastEvent(other.id, { sort_order: it.sort_order }),
      ])
      await fetchItems()
    } catch {
      toast.error("Reorder failed")
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (it: PastEvent) => {
    if (!window.confirm("Delete this past event? This can't be undone.")) return
    setBusyId(it.id)
    try {
      await adminAPI.deletePastEvent(it.id)
      setItems((prev) => prev.filter((x) => x.id !== it.id))
      toast.success("Deleted")
    } catch {
      toast.error("Delete failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Past events</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Upload photos from past shows. They appear on the home page under “Upcoming events”
                as an auto-scrolling strip. Add an optional caption or link per image.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add past event
            </button>
          </div>

          {/* List */}
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={History}
              title="No past events yet"
              description="Add your first photo. The home-page strip stays hidden until at least one is published."
            />
          ) : (
            <ul className="space-y-3">
              {items
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((it, i, arr) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    busy={busyId === it.id}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onEdit={() => openEdit(it)}
                    onToggleActive={() => toggleActive(it)}
                    onUp={() => move(it, -1)}
                    onDown={() => move(it, 1)}
                    onDelete={() => remove(it)}
                  />
                ))}
            </ul>
          )}

          {/* Editor modal */}
          {editing && (
            <ItemEditor
              isNew={editing === "new"}
              form={form}
              setForm={setForm}
              uploading={uploading}
              saving={saving}
              onUpload={handleUpload}
              onSave={handleSave}
              onClose={closeEditor}
            />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function ItemRow({
  item,
  busy,
  isFirst,
  isLast,
  onEdit,
  onToggleActive,
  onUp,
  onDown,
  onDelete,
}: {
  item: PastEvent
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onToggleActive: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center">
      {/* Thumb */}
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700 sm:w-48">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.title || "Past event"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        {!item.active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-800">
              Hidden
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            #{item.sort_order}
          </span>
          {item.title ? (
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
          ) : (
            <div className="text-xs italic text-gray-500">No caption</div>
          )}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-500">
          <LinkIcon className="h-3 w-3" />
          {item.link_url ? (
            <span className="truncate font-mono">{item.link_url}</span>
          ) : (
            <span className="italic">No link — image only</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <IconBtn title="Move up" disabled={isFirst || busy} onClick={onUp}>
          <ArrowUp className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Move down" disabled={isLast || busy} onClick={onDown}>
          <ArrowDown className="h-4 w-4" />
        </IconBtn>
        <IconBtn title={item.active ? "Hide" : "Show"} disabled={busy} onClick={onToggleActive}>
          {item.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="Edit" disabled={busy} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title="Delete"
          disabled={busy}
          onClick={onDelete}
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30"
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    </li>
  )
}

function IconBtn({
  children,
  title,
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 ${className}`}
    >
      {children}
    </button>
  )
}

function ItemEditor({
  isNew,
  form,
  setForm,
  uploading,
  saving,
  onUpload,
  onSave,
  onClose,
}: {
  isNew: boolean
  form: FormState
  setForm: (updater: (f: FormState) => FormState) => void
  uploading: boolean
  saving: boolean
  onUpload: (file: File) => Promise<void>
  onSave: () => Promise<void>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !saving && !uploading && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{isNew ? "Add past event" : "Edit past event"}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Landscape (16:9) photos look best in the scrolling strip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Image
            </label>
            {form.image_url ? (
              <div className="relative aspect-video overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="h-full w-full object-cover" />
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUpload(f)
                      e.target.value = ""
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-800 shadow hover:bg-white">
                    {uploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading…" : "Replace"}
                  </span>
                </label>
              </div>
            ) : (
              <label className="flex aspect-video cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-900/20">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUpload(f)
                    e.target.value = ""
                  }}
                />
                <div className="text-center">
                  {uploading ? (
                    <Loader className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    <ImagePlus className="mx-auto h-6 w-6 text-gray-400" />
                  )}
                  <div className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {uploading ? "Uploading…" : "Click to upload an image"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-400">PNG / JPG, up to 8 MB</div>
                </div>
              </label>
            )}
          </div>

          {/* Caption */}
          <Field label="Caption (optional)">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="e.g. Legends Live 2025"
            />
          </Field>

          {/* Link */}
          <Field label="Link (optional)" hint="Full URLs or relative paths both work. Leave blank for a non-clickable image.">
            <input
              type="text"
              value={form.link_url}
              onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
              maxLength={2048}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="https://example.com or /events/abc"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || uploading || !form.image_url}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isNew ? "Add" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  )
}
