import { useState, useEffect } from 'react';
import { 
  FileText, LayoutTemplate, History, UploadCloud, Plus, Save, 
  Trash2, Edit, Printer, FileDown, CheckCircle, Eye, Settings, Building2, Image as ImageIcon, X, ArchiveRestore, Landmark
} from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Documents() {
  const [activeTab, setActiveTab] = useState('templates');
  const [loading, setLoading] = useState(false);

  // Databases
  const [templates, setTemplates] = useState([]);
  const [documentLedger, setDocumentLedger] = useState([]);
  const [externalFiles, setExternalFiles] = useState([]);

  // Forms & UI States
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null); 
  
  // Universal Print States
  const [printingDoc, setPrintingDoc] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    name: '', type: 'Invoice (B2B/B2C)', headerText: 'YOUR DAIRY FARM', subHeader: '123 Agriculture Way, Farming District', 
    contactInfo: 'Phone: +91 9876543210 | GSTIN: XXXXXXXXXXXXXXX', fssai: '',
    bankName: '', bankAccount: '', ifsc: '', upi: '',
    footerText: 'Authorized Signatory', 
    terms: '1. Payment is due within 15 days.\n2. Subject to local jurisdiction.', 
    accentColor: '#059669', hideFinancials: false, logoFile: null, logoData: null
  });

  const [uploadForm, setUploadForm] = useState({ title: '', vendor: '', date: new Date().toISOString().split('T')[0], file: null, notes: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const tempSnap = await getDocs(query(collection(db, "document_templates"), orderBy("name", "asc")));
      setTemplates(tempSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const filesSnap = await getDocs(query(collection(db, "external_documents"), orderBy("upload_date", "desc")));
      const fetchedExternalFiles = filesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExternalFiles(fetchedExternalFiles);

      // Aggregating documents from across the ERP for the Master Ledger
      const [invoices, receipts, payments] = await Promise.all([
        getDocs(collection(db, "invoices")),
        getDocs(collection(db, "vap_sales")), 
        getDocs(collection(db, "vendor_payments"))
      ]);

      const masterLedger = [
        ...invoices.docs.map(d => ({ docId: d.id, docType: 'Invoice', date: d.data().date, entity: d.data().customerName, amount: d.data().amount, ref: d.data().invoiceNumber, raw: d.data() })),
        ...receipts.docs.map(d => ({ docId: d.id, docType: 'Dispatch Note', date: d.data().date, entity: d.data().buyer, amount: d.data().total_value, ref: `VAP-${d.id.slice(-5).toUpperCase()}`, raw: d.data() })),
        ...payments.docs.map(d => ({ docId: d.id, docType: 'Payment Voucher', date: d.data().date, entity: d.data().vendor, amount: d.data().amount, ref: `PV-${d.id.slice(-5).toUpperCase()}`, raw: d.data() })),
        ...fetchedExternalFiles.map(d => ({ docId: d.id, docType: 'External Record', date: d.upload_date, entity: d.vendor, amount: null, ref: d.title, raw: d }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setDocumentLedger(masterLedger);
    } catch (e) { console.error("Error fetching documents:", e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  // =========================================================================
  // TEMPLATE DESIGNER
  // =========================================================================

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) return alert("Please select a logo smaller than 500KB to ensure fast database saving.");
      const reader = new FileReader();
      reader.onloadend = () => {
        setTemplateForm({ ...templateForm, logoFile: file, logoData: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const dataToSave = {
      name: templateForm.name, type: templateForm.type, headerText: templateForm.headerText, subHeader: templateForm.subHeader,
      contactInfo: templateForm.contactInfo, fssai: templateForm.fssai,
      bankName: templateForm.bankName, bankAccount: templateForm.bankAccount, ifsc: templateForm.ifsc, upi: templateForm.upi,
      footerText: templateForm.footerText, terms: templateForm.terms,
      accentColor: templateForm.accentColor, hideFinancials: templateForm.hideFinancials, 
      logoData: templateForm.logoData, 
      updated_at: serverTimestamp()
    };

    try {
      if (editingTemplateId) {
        await updateDoc(doc(db, "document_templates", editingTemplateId), dataToSave);
        alert("Template Updated!");
      } else {
        await addDoc(collection(db, "document_templates"), { ...dataToSave, created_at: serverTimestamp() });
        alert("New Template Created!");
      }
      setShowTemplateForm(false);
      setEditingTemplateId(null);
      setTemplateForm({ name: '', type: 'Invoice (B2B/B2C)', headerText: 'YOUR DAIRY FARM', subHeader: '', contactInfo: '', fssai: '', bankName: '', bankAccount: '', ifsc: '', upi: '', footerText: '', terms: '', accentColor: '#059669', hideFinancials: false, logoFile: null, logoData: null });
      fetchData();
    } catch (error) { alert("Error saving template."); } finally { setLoading(false); }
  };

  const handleEditTemplate = (temp) => {
    setEditingTemplateId(temp.id);
    setTemplateForm({
      name: temp.name, type: temp.type, headerText: temp.headerText, subHeader: temp.subHeader,
      contactInfo: temp.contactInfo, fssai: temp.fssai || '',
      bankName: temp.bankName || '', bankAccount: temp.bankAccount || '', ifsc: temp.ifsc || '', upi: temp.upi || '',
      footerText: temp.footerText, terms: temp.terms,
      accentColor: temp.accentColor, hideFinancials: temp.hideFinancials || false, 
      logoFile: null, logoData: temp.logoData || null
    });
    setShowTemplateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (id) => {
    if(!window.confirm("Delete this template? Documents already printed will not be affected.")) return;
    try { await deleteDoc(doc(db, "document_templates", id)); fetchData(); } catch(e) { alert("Error deleting template."); }
  };

  // =========================================================================
  // EXTERNAL UPLOADS
  // =========================================================================
  const handleUploadExternalDoc = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return alert("Please select a file to upload.");
    setLoading(true);
    try {
      await addDoc(collection(db, "external_documents"), {
        title: uploadForm.title, vendor: uploadForm.vendor, upload_date: uploadForm.date,
        file_name: uploadForm.file.name, notes: uploadForm.notes, recorded_at: serverTimestamp()
      });
      alert("Document filed successfully!");
      setUploadForm({ title: '', vendor: '', date: new Date().toISOString().split('T')[0], file: null, notes: '' });
      fetchData();
    } catch (error) { alert("Error uploading document."); } finally { setLoading(false); }
  };

  // =========================================================================
  // PRINT ENGINE LOGIC (Triggered from outside or inside)
  // =========================================================================
  // To allow external modules (like Logistics) to call this, we typically pass a ref or use context.
  // For now, it's locally scoped, but we build the renderer to handle 'Customer Statement' arrays.
  
  const triggerPrintEngine = (doc) => {
    if (templates.length === 0) return alert("You must create at least one Document Template in the Designer before you can print.");
    
    let bestMatch = templates.find(t => t.type.includes(doc.docType.split(' ')[0]));
    if (!bestMatch && doc.docType === 'Dispatch Note') bestMatch = templates.find(t => t.type.includes('Delivery') || t.type.includes('Invoice'));
    
    setSelectedTemplate(bestMatch || templates[0]);
    setPrintingDoc(doc);
  };

  // Ensure global access if needed by Economics/Logistics
  window.triggerUniversalPrint = triggerPrintEngine;

  if (printingDoc && selectedTemplate) {
    const isPayment = printingDoc.docType === 'Payment Voucher';
    const isStatement = printingDoc.docType === 'Customer Statement'; // NEW: Monthly Bill
    const pDoc = printingDoc.raw || printingDoc.data || printingDoc; // Handle different payload structures

    return (
      <div className="bg-slate-100 min-h-screen p-10 print:p-0 absolute inset-0 z-[100]">
        
        {/* Controls */}
        <div className="print:hidden max-w-4xl mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-500 text-sm">Select Template:</span>
            <select 
              value={selectedTemplate.id} 
              onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value))}
              className="p-2 border border-slate-300 rounded font-bold text-slate-800 outline-none w-64"
            >
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded shadow flex items-center gap-2 transition"><Printer size={18}/> Print / Save PDF</button>
            <button onClick={() => { setPrintingDoc(null); setSelectedTemplate(null); }} className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold py-2 px-6 rounded shadow transition">Close</button>
          </div>
        </div>

        {/* Universal A4 Paper Canvas */}
        <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 relative overflow-hidden min-h-[1122px] flex flex-col">
          <div className="absolute top-0 left-0 w-full h-3 print:hidden" style={{ backgroundColor: selectedTemplate.accentColor }}></div>
          
          {/* Universal Header */}
          <div className="flex justify-between items-start border-b-2 pb-6 pt-2" style={{ borderColor: selectedTemplate.accentColor }}>
            <div className="flex gap-6 items-center">
              {selectedTemplate.logoData ? (
                <img src={selectedTemplate.logoData} alt="Logo" className="w-24 h-24 object-contain rounded" />
              ) : (
                <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 font-bold flex items-center justify-center text-xs text-center p-2 rounded">LOGO</div>
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: selectedTemplate.accentColor }}>{selectedTemplate.headerText}</h1>
                <p className="text-slate-600 font-medium whitespace-pre-wrap leading-tight mt-1">{selectedTemplate.subHeader}</p>
                <p className="text-slate-500 text-sm whitespace-pre-wrap mt-1">{selectedTemplate.contactInfo}</p>
                {selectedTemplate.fssai && <p className="text-slate-500 text-xs font-bold mt-1">FSSAI: {selectedTemplate.fssai}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black uppercase tracking-widest opacity-80" style={{ color: selectedTemplate.accentColor }}>
                {isStatement ? 'Monthly Statement' : printingDoc.docType}
              </h2>
              <p className="font-bold text-slate-800 mt-2">Ref #: {printingDoc.ref || `DOC-${Date.now().toString().slice(-6)}`}</p>
              <p className="text-slate-600 font-medium">Date: {printingDoc.date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          {/* Billed To / Issued To */}
          <div className="mt-6 mb-6">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">{isPayment ? 'Paid To:' : 'Billed To:'}</p>
            <p className="text-xl font-black text-slate-800">{printingDoc.entity || pDoc.customerName}</p>
            {isStatement && pDoc.month && <p className="text-sm font-bold text-slate-500 mt-1">Billing Period: {pDoc.month}</p>}
          </div>

          {/* =======================================================================
              LAYOUT FOR DETAILED CUSTOMER STATEMENTS (Monthly Milk Bill)
              ======================================================================= */}
          {isStatement ? (
            <>
              {/* Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 grid grid-cols-5 gap-4 text-center divide-x divide-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Qty</p>
                  <p className="text-lg font-black text-blue-700 mt-1">{pDoc.totalLiters} L</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakage</p>
                  <p className="text-lg font-black text-red-600 mt-1">₹{pDoc.brokenPenalty || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Advances / Paid</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">₹{pDoc.totalPaid || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate / L</p>
                  <p className="text-lg font-black text-slate-700 mt-1">₹{pDoc.rate}</p>
                </div>
                <div className="bg-slate-100 -m-4 p-4 rounded-r-lg border-l-2 border-slate-300">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Final Balance</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">₹{pDoc.netBalance}</p>
                </div>
              </div>

              {/* Detailed Ledger Table */}
              <table className="w-full text-left border-collapse mb-8 text-sm">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[10px] tracking-wider border-y-2 border-slate-800 text-slate-600">
                    <th className="py-2 px-3 font-bold">Date</th>
                    <th className="py-2 px-3 font-bold">Particulars</th>
                    <th className="py-2 px-3 font-bold text-center">Qty (L)</th>
                    <th className="py-2 px-3 font-bold text-center text-red-600">Breakage</th>
                    <th className="py-2 px-3 font-bold text-right">Daily Amt (₹)</th>
                  </tr>
                </thead>
                <tbody className="border-b-2 border-slate-800 divide-y divide-slate-100">
                  {pDoc.lineItems && pDoc.lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold text-slate-700">{item.date}</td>
                      <td className="py-2 px-3 text-slate-600">{item.isPayment ? `Payment Recvd (${item.method})` : 'Milk Delivery'}</td>
                      <td className="py-2 px-3 text-center font-bold text-blue-600">{item.isPayment ? '--' : item.qty}</td>
                      <td className="py-2 px-3 text-center text-red-500 text-xs">{item.broken > 0 ? `${item.broken} Bot` : '--'}</td>
                      <td className={`py-2 px-3 text-right font-bold ${item.isPayment ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {item.isPayment ? `-₹${item.amount}` : `+₹${item.amount}`}
                      </td>
                    </tr>
                  ))}
                  {(!pDoc.lineItems || pDoc.lineItems.length === 0) && <tr><td colSpan="5" className="py-4 text-center text-slate-400">No delivery data found for this period.</td></tr>}
                </tbody>
              </table>
            </>
          ) : (
            /* =======================================================================
               STANDARD LAYOUT (Single Invoices, Receipts, Vouchers)
               ======================================================================= */
            <table className="w-full text-left border-collapse mb-10">
              <thead>
                <tr className="bg-slate-50 uppercase text-xs tracking-wider border-y-2 border-slate-800">
                  <th className="py-4 px-4 font-bold">Particulars / Description</th>
                  {!selectedTemplate.hideFinancials && (
                    <>
                      <th className="py-4 px-4 font-bold text-center">Qty / Ref</th>
                      <th className="py-4 px-4 font-bold text-right">Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="border-b-2 border-slate-800">
                <tr>
                  <td className="py-6 px-4">
                    <span className="font-black text-slate-800 text-lg">
                      {isPayment ? `Payment / Settlement via ${pDoc.method}` : 
                       pDoc.product_name ? pDoc.product_name : 
                       (pDoc.type || 'Farm Goods & Services')}
                    </span>
                    <div className="text-sm text-slate-600 font-medium mt-1">{pDoc.notes || 'N/A'}</div>
                  </td>
                  
                  {!selectedTemplate.hideFinancials && (
                    <>
                      <td className="py-6 px-4 text-center font-bold text-slate-600">
                        {pDoc.qty ? `${pDoc.qty} ${pDoc.unit || ''}` : (pDoc.method || '--')}
                      </td>
                      <td className="py-6 px-4 text-right font-black text-slate-900 text-lg">
                        ₹{(Number(printingDoc.amount)||Number(pDoc.amount)||0).toLocaleString()}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          )}

          {/* Standard Financial Summary (For Non-Statements) */}
          {!isStatement && !selectedTemplate.hideFinancials && (
            <div className="flex justify-end mb-16">
              <div className="w-1/2 space-y-3 border-t-2 border-slate-200 pt-4">
                <div className="flex justify-between text-slate-900 font-black text-2xl pt-2">
                  <p>{isPayment ? 'Total Paid:' : 'Total Value:'}</p><p>₹{(Number(printingDoc.amount)||Number(pDoc.amount)||0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Universal Footer: Bank Details & Terms */}
          <div className="mt-auto border-t-2 border-slate-800 pt-6 flex justify-between items-start text-sm">
            <div className="w-2/3 pr-8 space-y-4">
              {/* Bank Details Render */}
              {(selectedTemplate.bankAccount || selectedTemplate.upi) && (
                <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs">
                  <p className="font-black text-slate-800 mb-2 uppercase tracking-widest border-b border-slate-200 pb-1">Bank & Payment Details</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 font-medium">
                    {selectedTemplate.bankName && <p>Bank: <span className="font-bold text-slate-800">{selectedTemplate.bankName}</span></p>}
                    {selectedTemplate.bankAccount && <p>A/C No: <span className="font-bold text-slate-800">{selectedTemplate.bankAccount}</span></p>}
                    {selectedTemplate.ifsc && <p>IFSC: <span className="font-bold text-slate-800">{selectedTemplate.ifsc}</span></p>}
                    {selectedTemplate.upi && <p>UPI ID: <span className="font-bold text-slate-800">{selectedTemplate.upi}</span></p>}
                  </div>
                </div>
              )}
              
              <div>
                <p className="font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Terms & Conditions:</p>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-500 text-xs">{selectedTemplate.terms}</p>
              </div>
            </div>

            <div className="text-center w-1/3 pt-12">
              <div className="w-full border-b-2 border-slate-800 mb-2"></div>
              <p className="font-bold text-slate-800 uppercase tracking-wider text-xs">{selectedTemplate.footerText}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* DOCUMENT VIEWER MODAL (For External Files) */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Eye size={18}/> Document Viewer</h3>
              <button onClick={() => setViewingDoc(null)} className="hover:text-slate-300 transition"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-32 h-40 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4">
                  <FileText size={40} className="mb-2 text-slate-300"/>
                  <span className="text-[10px] font-bold text-center break-all w-full leading-tight">{viewingDoc.file_name}</span>
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-sm">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Document Title</p><p className="font-bold text-slate-800">{viewingDoc.title}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Issuer / Vendor</p><p className="font-bold text-slate-800">{viewingDoc.vendor}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Upload Date</p><p className="font-bold text-slate-800">{viewingDoc.upload_date}</p></div>
                  <div className="col-span-2 pt-2 border-t border-slate-200"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Recorded Notes</p><p className="text-slate-700 italic">{viewingDoc.notes || 'No notes provided.'}</p></div>
                </div>
              </div>
              <div className="bg-blue-50 text-blue-800 text-xs font-bold p-3 rounded-lg flex items-center gap-2 border border-blue-200">
                <span>Note: To view actual rendered PDF images natively, Firebase Cloud Storage must be fully initialized.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="text-slate-800 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Document & Invoice Hub</h1>
            <p className="text-sm text-slate-500">Manage templates, track all generated system PDFs, and file external bills.</p>
          </div>
        </div>
        
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('templates')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'templates' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Template Designer</button>
          <button onClick={() => setActiveTab('ledger')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'ledger' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Master Document Ledger</button>
          <button onClick={() => setActiveTab('filing')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'filing' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>External Filing Cabinet</button>
        </div>
      </div>

      {/* TAB 1: TEMPLATE DESIGNER */}
      {activeTab === 'templates' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><LayoutTemplate className="text-slate-500"/> Blueprint Configurations</h2>
            <button onClick={() => {setShowTemplateForm(!showTemplateForm); setEditingTemplateId(null);}} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-700 transition">
              {showTemplateForm ? <><X size={16}/> Cancel</> : <><Plus size={16}/> New Template</>}
            </button>
          </div>

          {showTemplateForm && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Settings size={18}/> Formatting Options</h3>
                <form id="template-form" onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">TEMPLATE NAME</label><input type="text" required value={templateForm.name} onChange={(e)=>setTemplateForm({...templateForm, name: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Standard Retail Invoice" /></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">DOCUMENT TYPE</label>
                      <select value={templateForm.type} onChange={(e)=>setTemplateForm({...templateForm, type: e.target.value})} className="w-full p-2 border rounded outline-none font-bold text-slate-700">
                        <option>Invoice (B2B/B2C)</option><option>Receipt of Goods (GRN)</option><option>Payment Voucher</option><option>Delivery Challan</option><option>Customer Statement</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">FARM / COMPANY NAME (Header)</label><input type="text" required value={templateForm.headerText} onChange={(e)=>setTemplateForm({...templateForm, headerText: e.target.value})} className="w-full p-2 border rounded outline-none font-black text-slate-800" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">ADDRESS (Sub-header)</label><input type="text" value={templateForm.subHeader} onChange={(e)=>setTemplateForm({...templateForm, subHeader: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                    <div className="grid grid-cols-2 gap-2">
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">CONTACT / GSTIN</label><input type="text" value={templateForm.contactInfo} onChange={(e)=>setTemplateForm({...templateForm, contactInfo: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">FSSAI NO.</label><input type="text" value={templateForm.fssai} onChange={(e)=>setTemplateForm({...templateForm, fssai: e.target.value})} className="w-full p-2 border rounded outline-none font-bold" /></div>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><ImageIcon size={14}/> UPLOAD LOGO</label>
                       <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg space-y-3">
                     <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Landmark size={14}/> Legal & Banking Information</h4>
                     <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-[10px] font-bold text-slate-500 mb-1">BANK NAME</label><input type="text" value={templateForm.bankName} onChange={(e)=>setTemplateForm({...templateForm, bankName: e.target.value})} className="w-full p-2 border rounded outline-none text-xs" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 mb-1">ACCOUNT NO.</label><input type="text" value={templateForm.bankAccount} onChange={(e)=>setTemplateForm({...templateForm, bankAccount: e.target.value})} className="w-full p-2 border rounded outline-none text-xs" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 mb-1">IFSC CODE</label><input type="text" value={templateForm.ifsc} onChange={(e)=>setTemplateForm({...templateForm, ifsc: e.target.value})} className="w-full p-2 border rounded outline-none text-xs" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 mb-1">UPI ID</label><input type="text" value={templateForm.upi} onChange={(e)=>setTemplateForm({...templateForm, upi: e.target.value})} className="w-full p-2 border rounded outline-none text-xs" /></div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">FOOTER TEXT / SIGNATURE</label><input type="text" value={templateForm.footerText} onChange={(e)=>setTemplateForm({...templateForm, footerText: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="Authorized Signatory..." /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">BRAND ACCENT COLOR</label><input type="color" value={templateForm.accentColor} onChange={(e)=>setTemplateForm({...templateForm, accentColor: e.target.value})} className="w-full h-10 p-1 border rounded outline-none cursor-pointer" /></div>
                  </div>

                  <div><label className="block text-xs font-bold text-slate-500 mb-1">TERMS & CONDITIONS</label><textarea value={templateForm.terms} onChange={(e)=>setTemplateForm({...templateForm, terms: e.target.value})} className="w-full p-2 border rounded outline-none h-20 text-xs" placeholder="1. Goods once sold..."></textarea></div>
                  
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <input type="checkbox" id="hideFin" checked={templateForm.hideFinancials} onChange={(e)=>setTemplateForm({...templateForm, hideFinancials: e.target.checked})} className="w-5 h-5 accent-amber-600 cursor-pointer" />
                    <label htmlFor="hideFin" className="text-sm font-bold text-amber-900 cursor-pointer">Hide Financials & Rates (Use for Delivery/Receiving Notes)</label>
                  </div>
                </form>
              </div>

              {/* LIVE PREVIEW PANE */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: templateForm.accentColor }}></div>
                <div>
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] text-slate-400 border border-slate-200 overflow-hidden">
                        {templateForm.logoData ? (
                          <img src={templateForm.logoData} alt="Logo" className="w-full h-full object-contain" />
                        ) : "LOGO"}
                      </div>
                      <div>
                        <h1 className="text-xl font-black text-slate-900 leading-tight">{templateForm.headerText || 'YOUR DAIRY FARM'}</h1>
                        <p className="text-[10px] text-slate-500 whitespace-pre-wrap mt-0.5">{templateForm.subHeader || '123 Agriculture Way'}</p>
                        <p className="text-[10px] text-slate-500 whitespace-pre-wrap">{templateForm.contactInfo}</p>
                        {templateForm.fssai && <p className="text-[10px] font-bold text-slate-500 mt-1">FSSAI: {templateForm.fssai}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className="text-xl font-black uppercase tracking-widest opacity-20" style={{ color: templateForm.accentColor }}>{templateForm.type}</h2>
                    </div>
                  </div>
                  
                  {/* Dynamic Table Preview */}
                  <div className="bg-slate-50 h-24 rounded border border-slate-100 flex flex-col items-center justify-center text-xs text-slate-400 font-bold mb-4">
                    <p>[ Dynamic Item Data Will Populate Here ]</p>
                    {templateForm.type === 'Customer Statement' && <p className="text-[10px] font-normal mt-1 text-slate-500">Includes Summary Box + Detailed Day-by-Day Roster</p>}
                  </div>

                  {templateForm.hideFinancials && (
                    <div className="bg-amber-100 text-amber-800 text-xs font-bold p-2 rounded text-center mb-4 border border-amber-200">Financial columns hidden in this template.</div>
                  )}

                  {/* Bank Details Preview */}
                  {(templateForm.bankAccount || templateForm.upi) && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] mb-4">
                      <p className="font-bold text-slate-700 mb-1">Bank Details:</p>
                      <div className="grid grid-cols-2 gap-1 text-slate-500">
                        {templateForm.bankName && <p>Bank: {templateForm.bankName}</p>}
                        {templateForm.bankAccount && <p>A/C No: {templateForm.bankAccount}</p>}
                        {templateForm.ifsc && <p>IFSC: {templateForm.ifsc}</p>}
                        {templateForm.upi && <p>UPI: {templateForm.upi}</p>}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 whitespace-pre-wrap">{templateForm.terms}</div>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-end">
                  <p className="text-xs font-bold text-slate-700">{templateForm.footerText}</p>
                  <button disabled={loading} form="template-form" type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded hover:bg-slate-700 transition flex items-center gap-2">
                    <Save size={16}/> {editingTemplateId ? 'Update' : 'Save'} Template
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(temp => (
              <div key={temp.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: temp.accentColor }}></div>
                <div className="pl-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{temp.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">{temp.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-1">{temp.headerText}</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => handleEditTemplate(temp)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-100 flex-1 flex items-center justify-center gap-1"><Edit size={14}/> Modify</button>
                    <button onClick={() => handleDeleteTemplate(temp.id)} className="text-red-500 bg-red-50 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
            {templates.length === 0 && !showTemplateForm && <div className="col-span-3 text-center py-12 text-slate-400 font-medium">No custom templates built yet. Click 'New Template' to start.</div>}
          </div>
        </div>
      )}

      {/* TAB 2: MASTER DOCUMENT LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="text-blue-600"/> Master Print Ledger</h2>
            <p className="text-sm text-slate-500 mb-6">A unified timeline of every invoice, receipt, external bill, and payment voucher generated across the entire ERP system.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold">Date</th>
                    <th className="py-3 px-4 font-bold">Document Type</th>
                    <th className="py-3 px-4 font-bold">Reference #</th>
                    <th className="py-3 px-4 font-bold">Related Entity</th>
                    <th className="py-3 px-4 font-bold text-right text-slate-800">Financial Value</th>
                    <th className="py-3 px-4 font-bold text-right">Reprint / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documentLedger.map(doc => (
                    <tr key={doc.docId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-700">{doc.date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          doc.docType === 'Invoice' ? 'bg-blue-100 text-blue-800' :
                          doc.docType === 'Payment Voucher' ? 'bg-emerald-100 text-emerald-800' :
                          doc.docType === 'External Record' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                        }`}>{doc.docType}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">{doc.ref}</td>
                      <td className="py-3 px-4 font-black text-slate-800">{doc.entity}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-800">
                        {doc.amount !== null ? `₹${(Number(doc.amount)||0).toLocaleString()}` : '--'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {doc.docType === 'External Record' ? (
                          <button onClick={() => setViewingDoc(doc.raw)} className="text-amber-700 hover:text-amber-900 bg-amber-100 px-3 py-1.5 rounded font-bold text-xs flex items-center justify-end gap-2 ml-auto border border-amber-200 transition">
                            <Eye size={12}/> View Scan
                          </button>
                        ) : (
                          <button onClick={() => triggerPrintEngine(doc)} className="text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded font-bold text-xs flex items-center justify-end gap-2 ml-auto border border-slate-200 transition hover:bg-slate-200">
                            <Printer size={12}/> Print PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {documentLedger.length === 0 && <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No documents generated yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXTERNAL FILING CABINET */}
      {activeTab === 'filing' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><UploadCloud className="text-emerald-600"/> Upload External Bill</h2>
              <form onSubmit={handleUploadExternalDoc} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">DOCUMENT TITLE</label><input type="text" required value={uploadForm.title} onChange={(e)=>setUploadForm({...uploadForm, title: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Tractor Repair Invoice" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">VENDOR / ISSUER</label><input type="text" required value={uploadForm.vendor} onChange={(e)=>setUploadForm({...uploadForm, vendor: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">DOCUMENT DATE</label><input type="date" required value={uploadForm.date} onChange={(e)=>setUploadForm({...uploadForm, date: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                
                <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                   <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1"><FileDown size={14}/> UPLOAD PDF / IMAGE</label>
                   <input type="file" accept="image/*,.pdf" onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                </div>
                
                <div><label className="block text-xs font-bold text-slate-500 mb-1">NOTES</label><input type="text" value={uploadForm.notes} onChange={(e)=>setUploadForm({...uploadForm, notes: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                <button disabled={loading} type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition shadow disabled:bg-slate-400">File Document</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><ArchiveRestore className="text-emerald-600"/> Digital Filing Cabinet</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Doc Date</th>
                      <th className="py-3 px-4 font-bold">Title / Details</th>
                      <th className="py-3 px-4 font-bold">Issuer</th>
                      <th className="py-3 px-4 font-bold text-right">File / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {externalFiles.map(file => (
                      <tr key={file.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-700">{file.upload_date}</td>
                        <td className="py-3 px-4">
                          <p className="font-black text-slate-800">{file.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{file.notes}</p>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-600">{file.vendor}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button onClick={() => setViewingDoc(file)} className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-100 transition"><Eye size={12}/> View</button>
                             <button onClick={async () => { if(window.confirm("Delete this filed document?")) { await deleteDoc(doc(db, "external_documents", file.id)); fetchData(); } }} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {externalFiles.length === 0 && <tr><td colSpan="4" className="py-12 text-center text-slate-400 font-medium">No external documents filed yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}