import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { getSiteSettings, updateSiteSettings, uploadImageBlob } from "../lib/api";
import { useAdmin } from "../context/AdminContext";

export function About() {
  const { isAdmin } = useAdmin?.() || { isAdmin: false };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);

  const [edit, setEdit] = useState(false);
  const [aboutText, setAboutText] = useState("");
  const [aboutImageUrl, setAboutImageUrl] = useState("");
  const [pickedFile, setPickedFile] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getSiteSettings();
        setData(s);
        setAboutText(s?.about_text || "");
        setAboutImageUrl(s?.about_image_url || "");
        setPreview(s?.about_image_url || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onFile = (file) => {
    setPickedFile(file || null);
    if (file) {
      const u = URL.createObjectURL(file);
      if (preview?.startsWith?.("blob:")) URL.revokeObjectURL(preview);
      setPreview(u);
    } else {
      if (preview?.startsWith?.("blob:")) URL.revokeObjectURL(preview);
      setPreview(aboutImageUrl || "");
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      let finalUrl = aboutImageUrl || "";
      if (pickedFile) {
        finalUrl = await uploadImageBlob(pickedFile, pickedFile.name || "about.jpg");
      }
      const payload = {
        aboutText,
        aboutImageUrl: finalUrl,
        imprint: {
          full_name: data?.imprint_full_name || "",
          address: data?.imprint_address || "",
          email: data?.imprint_email || "",
          phone: data?.imprint_phone || "",
          company: data?.imprint_company || "",
          business_authority: data?.imprint_business_authority || "",
          vat_id: data?.imprint_vat_id || "",
        },
      };
      await updateSiteSettings(payload);
      const fresh = await getSiteSettings();
      setData(fresh);
      setAboutText(fresh?.about_text || "");
      setAboutImageUrl(fresh?.about_image_url || "");
      setPreview(fresh?.about_image_url || "");
      setPickedFile(null);
      setEdit(false);
      alert("Saved");
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="overflow-hidden">
          <img
            src={edit ? (preview || "https://placehold.co/900x1200?text=Upload") : (data?.about_image_url || "https://placehold.co/900x1200")}
            alt="Artist portrait"
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </Card>
        <div className="md:col-span-2">
          {!edit ? (
            <>
              <h1 className="text-3xl md:text-4xl font-bold heading-serif">About the Artist</h1>
              <div className="text-muted-foreground mt-1 space-y-3 leading-7">
                {(data?.about_text || "").split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {isAdmin && (
                <div className="mt-4">
                  <button className="px-3 py-2 rounded-md border" onClick={() => setEdit(true)}>Edit</button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold">Edit About</h1>
              <div>
                <label className="block text-xs uppercase mb-1">About Text</label>
                <textarea rows={8} className="w-full border rounded-md p-2 text-sm bg-background" value={aboutText} onChange={(e) => setAboutText(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs uppercase mb-1">About Image</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
                  <span className="text-xs">or URL</span>
                  <input
                    className="border rounded-md p-2 text-sm flex-1"
                    placeholder="https://…"
                    value={aboutImageUrl}
                    onChange={(e) => { setAboutImageUrl(e.target.value); setPickedFile(null); setPreview(e.target.value); }}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-2 rounded-md border" onClick={() => setEdit(false)}>Cancel</button>
                <button className="px-3 py-2 rounded-md border bg-black text-white" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Impressum() {
  const { isAdmin } = useAdmin?.() || { isAdmin: false };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(false);

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [authority, setAuthority] = useState("");
  const [vat, setVat] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getSiteSettings();
        setData(s);
        setFullName(s?.imprint_full_name || "");
        setAddress(s?.imprint_address || "");
        setEmail(s?.imprint_email || "");
        setPhone(s?.imprint_phone || "");
        setCompany(s?.imprint_company || "");
        setAuthority(s?.imprint_business_authority || "");
        setVat(s?.imprint_vat_id || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const all = [
      ["Full name", data.imprint_full_name, true],
      ["Address", data.imprint_address, true],
      ["Email", data.imprint_email, true],
      ["Phone", data.imprint_phone, false],
      ["Company", data.imprint_company, false],
      ["Business authority", data.imprint_business_authority, false],
      ["VAT ID", data.imprint_vat_id, false],
    ];
    return all.filter(([_, v, req]) => req || (v && String(v).trim() !== ""));
  }, [data]);

  const onSave = async () => {
    if (!fullName.trim() || !address.trim() || !email.trim()) {
      alert("Full name, address and email are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        aboutText: data?.about_text || "",
        aboutImageUrl: data?.about_image_url || "",
        imprint: {
          full_name: fullName.trim(),
          address: address.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          business_authority: authority.trim() || undefined,
          vat_id: vat.trim() || undefined,
        },
      };
      await updateSiteSettings(payload);
      const fresh = await getSiteSettings();
      setData(fresh);
      setEdit(false);
      alert("Saved");
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-10">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-3xl md:text-4xl font-bold heading-serif">Impressum</h1>
        {isAdmin && <button className="px-3 py-2 rounded-md border" onClick={() => setEdit((v) => !v)}>{edit ? "Close" : "Edit"}</button>}
      </div>

      {!edit ? (
        <div className="mt-4 space-y-2 text-sm leading-7 text-muted-foreground">
          {rows.length === 0 ? <p>No Impressum data.</p> : rows.map(([label, value]) => (
            <p key={label}><span className="font-medium">{label}:</span> {value}</p>
          ))}
        </div>
      ) : (
        <div className="p-4 border rounded-md space-y-3">
          <div>
            <label className="block text-xs uppercase mb-1">Full name *</label>
            <input className="w-full border rounded-md p-2 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase mb-1">Full address *</label>
            <textarea rows={3} className="w-full border rounded-md p-2 text-sm" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase mb-1">Email *</label>
            <input type="email" className="w-full border rounded-md p-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase mb-1">Phone (optional)</label>
              <input className="w-full border rounded-md p-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs uppercase mb-1">Company (optional)</label>
              <input className="w-full border rounded-md p-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs uppercase mb-1">Business authority (optional)</label>
              <input className="w-full border rounded-md p-2 text-sm" value={authority} onChange={(e) => setAuthority(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs uppercase mb-1">VAT ID (optional)</label>
              <input className="w-full border rounded-md p-2 text-sm" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded-md border" onClick={() => setEdit(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-md border bg-black text-white" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
