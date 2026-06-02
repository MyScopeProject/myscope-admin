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
  Handshake,
  ImagePlus,
  Link as LinkIcon,
  Loader,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

interface Partner {
  id: string
  image_url: string
  name: string | null
  website_url: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type FormState = {
  image_url: string
  name: string
  website_url: string
}

const emptyForm = (): FormState => ({ image_url: "", name: "", website_url: "" })

export default function PartnersPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.listPartners()
      setItems(res.data?.data?.items || [])
    } catch {
      toast.error("Failed to load partners")
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

  const openEdit = (it: Partner) => {
    setForm({
      image_url: it.image_url ?? "",
      name: it.name ?? "",
      website_url: it.website_url ?? "",
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
      const res = await adminAPI.uploadPartnerImage(file)
      const url = res.data?.data?.url
      if (!url) throw new Error("No URL returned")
      setForm((f) => ({ ...f, image_url: url }))
      toast.success("Logo uploaded")
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.image_url) {
      toast.error("Upload a logo first.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        image_url: form.image_url,
        name: form.name.trim() || null,
        website_url: form.website_url.trim() || null,
      }
      if (editing === "new") {
        await adminAPI.createPartner(payload)
        toast.success("Partner added")
      } else if (editing) {
        await adminAPI.updatePartner(editing, payload)
        toast.success("Partner updated")
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

  const toggleActive = async (it: Partner) => {
    setBusyId(it.id)
    try {
      await adminAPI.updatePartner(it.id, { active: !it.active })
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, active: !it.active } : x)))
    } catch {
      toast.error("Failed to toggle")
    } finally {
      setBusyId(null)
    }
  }

  const move = async (it: Partner, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === it.id)
    const target = idx + direction
    if (target < 0 || target >= sorted.length) return
    const other = sorted[target]
    setBusyId(it.id)
    try {
      await Promise.all([
        adminAPI.updatePartner(it.id, { sort_order: other.sort_order }),
        adminAPI.updatePartner(other.id, { sort_order: it.sort_order }),
      ])
      await fetchItems()
    } catch {
      toast.error("Reorder failed")
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (it: Partner) => {
    if (!window.confirm("Delete this partner? This can't be undone.")) return
    setBusyId(it.id)
    try {
      await adminAPI.deletePartner(it.id)
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
              <h1 className="text-2xl font-bold tracking-tight">Our Partners</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Upload partner logos. They appear on the home page above the footer
                as an auto-scrolling strip. Add an optional partner name or website link per logo.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add partner
            </button>
          </div>

          {/* List */}
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No partners yet"
              description="Add your first partner logo. The home-page strip stays hidden until at least one is published."
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
  item: Partner
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
      {/* Thumb — contain (not cover) so the full logo is visible without
          cropping. Logos are typically letterboxed / non-square. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700 sm:w-40">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name || "Partner"} className="h-full w-full object-contain p-2" />
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
          {item.name ? (
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
          ) : (
            <div className="text-xs italic text-gray-500">No name</div>
          )}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-500">
          <LinkIcon className="h-3 w-3" />
          {item.website_url ? (
            <span className="truncate font-mono">{item.website_url}</span>
          ) : (
            <span className="italic">No website — logo only</span>
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
            <h2 className="text-lg font-semibold">{isNew ? "Add partner" : "Edit partner"}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Transparent PNG logos look best in the scrolling strip.
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
          {/* Logo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Logo
            </label>
            {form.image_url ? (
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="h-full w-full object-contain p-3" />
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
              <label className="mx-auto flex aspect-square w-full max-w-xs cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-900/20">
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
                    {uploading ? "Uploading…" : "Click to upload a logo"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-400">PNG / JPG / WebP, up to 8 MB</div>
                </div>
              </label>
            )}
          </div>

          {/* Name */}
          <Field label="Partner name (optional)">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="e.g. Acme Corp"
            />
          </Field>

          {/* Website */}
          <Field label="Website (optional)" hint="Full URLs or relative paths both work. Leave blank for a non-clickable logo.">
            <input
              type="text"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              maxLength={2048}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="https://example.com"
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
