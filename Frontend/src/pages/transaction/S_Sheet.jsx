import React from 'react'
import { useState, useEffect, useRef } from 'react'
import "./transaction.css";
import { useTransaction } from '../../context/TransactionContext';
import { useSalesman } from '../../context/SalesmanContext';
import { useSalesmanModal } from '../../context/SalesmanModalContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/api';
import { useSKU } from '../../context/SKUContext';
import { ItemBreakdownModal } from "./ItemBreakdownModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import pepsiLogo from "../../assets/pepsi_logo.png";
import { useDepo } from '../../context/depoContext';
import { useAuth } from '../../context/AuthContext'


const S_Sheet = () => {
  const { showToast } = useToast();
  const { getSettlement, loading } = useTransaction();
  const { salesmans } = useSalesman();

  const [sheetData, setSheetData] = useState(null);
  const { items } = useSKU();

  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const codeRef = useRef(null);
  const dateRef = useRef(null);
  const tripRef = useRef(null);
  const findRef = useRef(null);
  const loadImageBase64 = (url) =>

    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = url;
    });

  const getDepo = (depo) => {
    if (!depo || !Array.isArray(depos)) return "";
    const id = String(depo).trim();
    const matchDepo = depos.find((d) => String(d._id).trim() === id);
    return matchDepo;
  }
  const { depos } = useDepo();
  const { user } = useAuth();

  const { openSalesmanModal } = useSalesmanModal();

  const [sheet, setSheet] = useState({
    salesmanCode: "",
    date: "",
    trip: 1,
    schm: "",
    ref: "",
    cashDeposited: "",
    chequeDeposited: "",
    credit: "",
    tax: "",
    remark: ""
  });

  const [editableFields, setEditableFields] = useState({
    schm: "",
    ref: "",
    cashDeposited: "",
    chequeDeposited: "",
    credit: "",
    tax: "",
    remark: ""
  });

  const exportSettlementPDF = async () => {
    if (!sheetData?.items?.length) {
      showToast("No settlement data to export", "error");
      return;
    }
    console.log(sheetData.items[0]);


    const doc = new jsPDF();

    const logoBase64 = await loadImageBase64(pepsiLogo);
    doc.addImage(logoBase64, "PNG", 12, 5, 35, 18);

    doc.setFontSize(14);
    doc.text("SAN BEVERAGES PVT LTD", 105, 15, { align: "center" });

    doc.setFontSize(8);
    doc.text(getDepo(user.depo)?.depoAddress || "", 105, 22, { align: "center" });

    doc.setFontSize(10);
    doc.text("SETTLEMENT SHEET REPORT", 105, 30, { align: "center" });

    const tableData = sheetData.items.map((it, i) => {
      const sku = items.find(s => s.code === it.itemCode);

      return [
        i + 1,
        it.itemCode,
        sku?.name || "",
        it.loadedQty || 0,
        it.returnedQty || 0,
        it.finalQty || 0,
        it.finalPrice || 0,
        it.amount || 0
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [[
        "SL",
        "CODE",
        "NAME",
        "LOAD OUT",
        "LOAD IN",
        "FINAL QTY",
        "RATE",
        "AMOUNT"
      ]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    const blob = doc.output("bloburl");
    const w = window.open(blob);
    w.onload = () => w.print();
  };

  const exportSettlementExcel = async () => {
    if (!sheetData?.items?.length) {
      showToast("No settlement data to export", "error");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Settlement");

    const logoBase64 = await loadImageBase64(pepsiLogo);

    const imageId = workbook.addImage({
      base64: logoBase64,
      extension: "png"
    });

    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 70 }
    });

    sheet.mergeCells("C2:I2");
    sheet.mergeCells("C3:I3");
    sheet.mergeCells("C5:I5");

    sheet.getCell("C2").value = "SAN BEVERAGES PVT LTD";
    sheet.getCell("C3").value = getDepo(user.depo)?.depoAddress || "";
    sheet.getCell("C5").value = "ITEM-WISE SETTLEMENT SHEET";

    sheet.getCell("C2").alignment = { horizontal: "center" };
    sheet.getCell("C3").alignment = { horizontal: "center" };
    sheet.getCell("C5").alignment = { horizontal: "center" };

    sheet.getCell("C2").font = { bold: true, size: 14 };
    sheet.getCell("C5").font = { bold: true };

    sheet.getRow(7).values = [
      "SL",
      "CODE",
      "NAME",
      "LOAD OUT",
      "LOAD IN",
      "FINAL QTY",
      "RATE",
      "AMOUNT"
    ];

    sheet.getRow(7).font = { bold: true };

    sheetData.items.forEach((it, i) => {
      const sku = items.find(s => s.code === it.itemCode);

      sheet.addRow([
        i + 1,
        it.itemCode,
        sku?.name || "",
        it.loadedQty || 0,
        it.returnedQty || 0,
        it.finalQty || 0,
        it.finalPrice || 0,
        it.amount || 0
      ]);
    });

    sheet.columns = [
      { width: 6 },
      { width: 12 },
      { width: 30 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "settlement-sheet.xlsx");
  };

  const handleSaveSettlement = async () => {
    const hasAnyField = Object.values(editableFields).some(val => val !== "");
    if (!hasAnyField) {
      showToast("Enter at least one field to save", "error");
      return;
    }

    try {
      const updatePayload = {
        salesmanCode: sheetData.salesmanCode.trim().toUpperCase(),
        date: sheetData.date,
        trip: sheetData.trip,
      };

      if (editableFields.schm !== "") updatePayload.schm = Number(editableFields.schm);
      if (editableFields.ref !== "") updatePayload.ref = Number(editableFields.ref);
      if (editableFields.cashDeposited !== "") updatePayload.cashDeposited = Number(editableFields.cashDeposited);
      if (editableFields.chequeDeposited !== "") updatePayload.chequeDeposited = Number(editableFields.chequeDeposited);
      if (editableFields.credit !== "") updatePayload.credit = Number(editableFields.credit);
      if (editableFields.tax !== "") updatePayload.tax = Number(editableFields.tax);
      if (editableFields.remark !== "") updatePayload.remark = editableFields.remark;

      const res = await api.post('/transaction/settlement/update', updatePayload);

      showToast(res.data.message, "success");

      // Re-fetch settlement to get accurate server-computed values
      try {
        const freshData = await getSettlement({
          salesmanCode: sheetData.salesmanCode.trim().toUpperCase(),
          date: sheetData.date,
          trip: sheetData.trip
        });
        setSheetData(freshData);
        // Repopulate editable fields from fresh data
        setEditableFields({
          schm: freshData.schm || "",
          ref: freshData.cashCreditDetails?.ref || "",
          cashDeposited: freshData.cashCreditDetails?.cashDeposited || "",
          chequeDeposited: freshData.cashCreditDetails?.chequeDeposited || "",
          credit: freshData.cashCreditDetails?.creditSale || "",
          tax: freshData.tax || "",
          remark: freshData.remark || ""
        });
      } catch (refetchErr) {
        console.error("Failed to refresh data after save", refetchErr);
      }

    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || "Failed to save settlement data", "error");
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!sheet.salesmanCode || !sheet.date) {
      showToast("Fill all fields properly", "error");
      return;
    }

    try {
      const data = await getSettlement({
        salesmanCode: sheet.salesmanCode.trim().toUpperCase(),
        date: sheet.date,
        trip: Number(sheet.trip) || 1
      });

      setSheetData(data);

      console.log(data);

      // Load existing values into editable fields
      setEditableFields({
        schm: data.schm || "",
        ref: data.cashCreditDetails?.ref || "",
        cashDeposited: data.cashCreditDetails?.cashDeposited || "",
        chequeDeposited: data.cashCreditDetails?.chequeDeposited || "",
        credit: data.cashCreditDetails?.creditSale || "",
        tax: data.tax || "",
        remark: data.remark || ""
      });

      setSheet({
        salesmanCode: "",
        date: "",
        trip: 1,
        schm: ""
      });
    } catch (err) {
      console.log(err);
    }
  };

  let totalA = 0;
  let totalB = 0;

  // Compute derived values from current editable fields
  const netSale = sheetData?.totals?.NetSale || 0;
  const currentRef = editableFields.ref !== "" ? Number(editableFields.ref) : (sheetData?.cashCreditDetails?.ref || 0);
  const currentSchm = editableFields.schm !== "" ? Number(editableFields.schm) : (sheetData?.schm || 0);
  const currentCashDeposited = editableFields.cashDeposited !== "" ? Number(editableFields.cashDeposited) : (sheetData?.cashCreditDetails?.cashDeposited || 0);
  const currentChequeDeposited = editableFields.chequeDeposited !== "" ? Number(editableFields.chequeDeposited) : (sheetData?.cashCreditDetails?.chequeDeposited || 0);
  const currentCredit = editableFields.credit !== "" ? Number(editableFields.credit) : (sheetData?.cashCreditDetails?.creditSale || 0);
  const totalRefund = sheetData?.totals?.totalRefund || 0;

  const computedTotalA = netSale - currentRef;
  const computedCashSale = netSale - currentSchm;
  const computedTotalDeposited = parseFloat((currentCashDeposited + currentChequeDeposited + currentCredit).toFixed(2));
  const computedTotalPayable = netSale - totalRefund - currentSchm - currentRef;
  const computedShortOrExcess = parseFloat((computedTotalDeposited - computedTotalPayable).toFixed(2));
  const computedCashShort = computedShortOrExcess < 0 ? -computedShortOrExcess : 0;

  const calculateTotalA = (sale, ref) => {
    if (!sale || !ref) return;
    totalA = sale - ref;
    return totalA;
  }

  const handleKeyNav = (e, currentField) => {
    if (["ArrowRight", "ArrowDown", "Enter"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Enter" && currentField === "find") {
        findRef.current?.click();
        return;
      }
      switch (currentField) {
        case "code":
          dateRef.current?.focus();
          break;
        case "date":
          tripRef.current?.focus();
          break;
        case "trip":
          if (e.key === "Enter") {
            findRef.current?.click();
          } else {
            findRef.current?.focus();
          }
          break;
        default:
          break;
      }
    } else if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      switch (currentField) {
        case "date":
          codeRef.current?.focus();
          break;
        case "trip":
          dateRef.current?.focus();
          break;
        case "find":
          tripRef.current?.focus();
          break;
        default:
          break;
      }
    }
  };


  const matchedSalesman = Array.isArray(salesmans)
    ? salesmans.find((sm) => String(sm.codeNo || sm.code || '').toUpperCase() === String(sheet.salesmanCode || sheetData?.salesmanCode || '').toUpperCase())
    : null;


  return (
    <div className='trans'>
      <div className="trans-container">
        <div className="trans-left">
          <form className="trans-form">
            <div className="salesman-detail">
              <div className="form-group">
                <label>Salesman Code</label>
                <div className="input-with-btn">
                  <input
                    type="text"
                    placeholder='Enter Salesman code'
                    value={sheet.salesmanCode || sheetData?.salesmanCode || ""}
                    onChange={(e) => setSheet({ ...sheet, salesmanCode: e.target.value.trim().toUpperCase() })}
                    onKeyDown={(e) => handleKeyNav(e, "code")}
                    ref={codeRef}
                  />
                  <button
                    type="button"
                    className="dropdown-btn"
                    onClick={() =>
                      openSalesmanModal((code) =>
                        setSheet(prev => ({ ...prev, salesmanCode: code.trim().toUpperCase() }))
                      )
                    }
                  >
                    ⌄
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Salesman Name</label>
                <input
                  readOnly
                  type="text"
                  value={matchedSalesman ? matchedSalesman.name.trim().toUpperCase() : ""}
                  style={{ backgroundColor: "#f5f5f5" }}
                />
              </div>
              <div className="form-group">
                <label>Route No.</label>
                <input
                  readOnly
                  type="number"
                  value={matchedSalesman ? matchedSalesman.routeNo : ""}
                  style={{ backgroundColor: "#f5f5f5" }}
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={sheet.date || sheetData?.date || ""}
                  onChange={(e) => setSheet({ ...sheet, date: e.target.value })}
                  onKeyDown={(e) => handleKeyNav(e, "date")}
                  ref={dateRef}
                />
              </div>
              <div className="form-group">
                <label>Trip No.</label>
                <input
                  type="number"
                  value={sheet.trip || sheetData?.trip || ""}
                  onChange={(e) => setSheet({ ...sheet, trip: e.target.value })}
                  ref={tripRef}
                  onKeyDown={(e) => handleKeyNav(e, "trip")}
                  placeholder='Enter trip no.'
                />
              </div>
            </div>
          </form>

          <div className="item-inputs">
            <div className="gap1">
              <div className="flex">
                <div className="form-group">
                  <label>NET SALE</label>
                  <input
                    readOnly
                    value={sheetData?.totals?.NetSale || 0}
                    type="number"
                    placeholder="Enter Sale Price"
                  />
                </div>
                <div className="form-group">
                  <label>DEP/REF</label>
                  <input
                    value={editableFields.ref}
                    type="number"
                    onChange={(e) => setEditableFields({ ...editableFields, ref: e.target.value })}
                    placeholder="Enter"
                  />
                </div>
                <div className="form-group">
                  <label>TOTAL A</label>
                  <input
                    readOnly
                    value={sheetData ? computedTotalA : 0}
                    type="number"
                  />
                </div>
              </div>
              <div className="flex">
                <div className="form-group">
                  <label>SMP,DSC,INCM,SCME</label>
                  <input
                    type="number"
                    value={editableFields.schm}
                    onChange={(e) => setEditableFields({ ...editableFields, schm: e.target.value })}
                    placeholder="Enter discount"
                  />
                </div>
                <div className="form-group">
                  <label>REFUNDS</label>
                  <input
                    readOnly
                    type="number"
                    value={sheetData?.totals?.totalRefund || 0}
                  />
                </div>
                <div className="form-group">
                  <label>CREDIT SALE</label>
                  <input
                    type="number"
                    placeholder='Enter Credit Sale'
                    value={editableFields.credit}
                    onChange={(e) => setEditableFields({ ...editableFields, credit: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="gap2">
              <div className="flex">
                <div className="form-group">
                  <label>Cash Sale</label>
                  <input
                    readOnly
                    type="number"
                    value={sheetData ? computedCashSale : 0}
                  />
                </div>
                <div className="form-group">
                  <label>Cash Deposited</label>
                  <input
                    type="number"
                    placeholder='Enter Cash Deposited'
                    value={editableFields.cashDeposited}
                    onChange={(e) => setEditableFields({ ...editableFields, cashDeposited: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Cheq.Desposited</label>
                  <input
                    type="number"
                    placeholder='Enter Cheq.Desposited'
                    value={editableFields.chequeDeposited}
                    onChange={(e) => setEditableFields({ ...editableFields, chequeDeposited: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex">
                <div className="form-group">
                  <label>Net Collection</label>
                  <input
                    readOnly
                    type="number"
                    value={sheetData ? computedTotalDeposited : 0}
                  />
                </div>
                <div className="form-group">
                  <label>Cash Short</label>
                  <input
                    readOnly
                    type="number"
                    value={sheetData ? computedCashShort : 0}
                  />
                </div>
                <div className="form-group">
                  <label>Short/Excess</label>
                  <input
                    readOnly
                    type="number"
                    style={{
                      color: computedShortOrExcess > 0 ? '#22c55e' : computedShortOrExcess < 0 ? '#ef4444' : 'inherit',
                      fontWeight: computedShortOrExcess !== 0 ? 'bold' : 'normal'
                    }}
                    value={sheetData ? computedShortOrExcess : 0}
                  />
                </div>
              </div>
              <div style={{ marginTop: "-10px" }}>
                <div className="form-group" style={{ marginBottom: "0px" }}>
                  <label style={{ marginBottom: "2px" }}>Remark</label>
                  <input
                    type="text"
                    value={editableFields.remark}
                    onChange={(e) => setEditableFields({ ...editableFields, remark: e.target.value })}
                    placeholder="Enter remark"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <div className="flex">
        <button
          className='trans-submit-btn'
          ref={findRef}
          onClick={handleSubmit}
          onKeyDown={(e) => handleKeyNav(e, "find")}
          disabled={loading}
        >
          {loading ? "Loading..." : "Find"}
        </button>


        {sheetData && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => {
                setSelectedItems(sheetData.items);
                setShowItemModal(true);
              }}
            >
              View Item Breakdown
            </button>

            <button
              className="trans-submit-btn"
              onClick={handleSaveSettlement}
            >
              Save Settlement
            </button>
          </>
        )}
        {sheetData && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="export-btn pdf trans-submit-btn" onClick={exportSettlementPDF}>
              📄 Export PDF
            </button>

            <button className="export-btn excel trans-submit-btn" onClick={exportSettlementExcel}>
              📊 Export Excel
            </button>
          </div>
        )}

      </div>
      <ItemBreakdownModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        items={selectedItems}
        skuItems={items}
      />
    </div >
  )
}

export default S_Sheet;
