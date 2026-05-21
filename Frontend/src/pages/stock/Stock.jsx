// import React, { useState, useEffect } from 'react';
// import api from '../../api/api';
// import './Stock.css';

// const StockDashboard = () => {
//     const [stockData, setStockData] = useState([]);
//     const [expiringItems, setExpiringItems] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [activeTab, setActiveTab] = useState('stock');
//     const [searchTerm, setSearchTerm] = useState('');
//     const [expiryDays, setExpiryDays] = useState(30);
//     const [expandedItem, setExpandedItem] = useState(null);

//     // Fetch stock data
//     const fetchStock = async () => {
//         setLoading(true);
//         try {
//             const response = await api.get('/stock');
//             if (response?.data?.success) {
//                 setStockData(response?.data?.data);
//             }
//         } catch (error) {
//             console.error('Error fetching stock:', error);
//         }
//         setLoading(false);
//     };

//     // Fetch expiring items
//     const fetchExpiringItems = async () => {
//         try {
//             const response = await api.get(`/stock/expiring?days=${expiryDays}`);

//             if (response?.data?.success) {
//                 setExpiringItems(response?.data?.data);
//             }
//         } catch (error) {
//             console.error('Error fetching expiring items:', error);
//         }
//     };

//     // Manual cleanup
//     const handleCleanup = async () => {
//         if (!window.confirm('Are you sure you want to cleanup expired items?')) return;

//         try {
//             const response = await api.post('/stock/cleanup');
//             if (response?.data?.success) {
//                 alert(`Cleanup completed! Removed ${response.data.totalExpiredQty} expired items.`);
//                 fetchStock();
//                 fetchExpiringItems();
//             }
//         } catch (error) {
//             console.error('Error during cleanup:', error);
//             alert('Cleanup failed!');
//         }
//     };

//     useEffect(() => {
//         fetchStock();
//         fetchExpiringItems();
//     }, []);

//     useEffect(() => {
//         if (activeTab === 'expiring') {
//             fetchExpiringItems();
//         }
//     }, [expiryDays, activeTab]);

//     // Filter stock based on search
//     const filteredStock = stockData.filter(item =>
//         item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
//     );

//     const formatDate = (date) => {
//         return new Date(date).toLocaleDateString('en-IN', {
//             day: '2-digit',
//             month: 'short',
//             year: 'numeric'
//         });
//     };

//     return (
//         <div className="box">
//             <div className="header">
//                 <h2 className="title">Stock Management Dashboard</h2>
//                 <button onClick={handleCleanup} className="cleanup-btn">
//                     🗑️ Cleanup Expired Items
//                 </button>
//             </div>
//             <div className="table-container">
//                 <div className="head">
//                     <input
//                         type="text"
//                         placeholder="Search item code..."
//                         value={searchTerm}
//                         onChange={(e) => setSearchTerm(e.target.value)}
//                         className="search-input"
//                     />

//                     {activeTab === 'expiring' && (
//                         <select
//                             value={expiryDays}
//                             onChange={(e) => setExpiryDays(Number(e.target.value))}
//                             className="select"
//                         >
//                             <option value={3}>3 Days</option>
//                             <option value={7}>7 Days</option>
//                             <option value={15}>15 Days</option>
//                             <option value={30}>30 Days</option>
//                         </select>
//                     )}


//                     <div className="tabs">
//                         <button
//                             onClick={() => setActiveTab('stock')}
//                             className={`tab ${activeTab === 'stock' ? 'tab-active' : ''}`}
//                         >
//                             Current Stock
//                         </button>
//                         <button
//                             onClick={() => setActiveTab('expiring')}
//                             className={`tab ${activeTab === 'expiring' ? 'tab-active' : ''}`}
//                         >
//                             Expiring Soon
//                         </button>
//                     </div>

//                 </div>

//                 {loading ? (
//                     <div className="loading">Loading stock data...</div>
//                 ) : (
//                     <>
//                         {activeTab === 'stock' && (
//                             <div className="table-container">
//                                 <div className="stats-bar">
//                                     <div className="stat">
//                                         <span className="stat-label">Total Items:</span>
//                                         <span className="stat-value">{filteredStock.length}</span>
//                                     </div>
//                                     <div className="stat">
//                                         <span className="stat-label">Total Quantity:</span>
//                                         <span className="stat-value">
//                                             {filteredStock.reduce((sum, item) => sum + item.totalQty, 0)}
//                                         </span>
//                                     </div>
//                                 </div>

//                                 <div className="grid-row header">
//                                     <div className="grid-cell">Item Code</div>
//                                     <div className="grid-cell">Total Qty</div>
//                                     <div className="grid-cell">Batches</div>
//                                     <div className="grid-cell">Nearest Expiry</div>
//                                     <div className="grid-cell">Actions</div>
//                                 </div>

//                                 {filteredStock.length === 0 ? (
//                                     <div className="no-data">No stock items found</div>
//                                 ) : (
//                                     filteredStock.map((item, index) => (
//                                         <div key={index}>
//                                             <div className={`grid-row ${index % 2 === 0 ? 'grid-row-even' : ''}`}>
//                                                 <div className="grid-cell">
//                                                     <strong>{item.itemCode}</strong>
//                                                 </div>
//                                                 <div className="grid-cell">
//                                                     <span className="qty-badge">{item.totalQty}</span>
//                                                 </div>
//                                                 <div className="grid-cell">{item.batches.length}</div>
//                                                 <div className="grid-cell">
//                                                     {item.batches[0] && (
//                                                         <span className={`expiry-badge ${item.batches[0].daysUntilExpiry <= 7 ? 'expiry-warning' : ''}`}>
//                                                             {formatDate(item.batches[0].expiryDate)}
//                                                             <br />
//                                                             ({item.batches[0].daysUntilExpiry} days)
//                                                         </span>
//                                                     )}
//                                                 </div>
//                                                 <div className="grid-cell">
//                                                     <button
//                                                         onClick={() => setExpandedItem(expandedItem === item.itemCode ? null : item.itemCode)}
//                                                         className="view-btn"
//                                                     >
//                                                         {expandedItem === item.itemCode ? '▲ Hide' : '▼ View Batches'}
//                                                     </button>
//                                                 </div>
//                                             </div>

//                                             {expandedItem === item.itemCode && (
//                                                 <div className="batches-container">
//                                                     <h4 className="batches-title">Batches for {item.itemCode}</h4>
//                                                     <div className="batch-grid-header">
//                                                         <div className="batch-grid-cell">Purchase Date</div>
//                                                         <div className="batch-grid-cell">Quantity</div>
//                                                         <div className="batch-grid-cell">Expiry Date</div>
//                                                         <div className="batch-grid-cell">Days Until Expiry</div>
//                                                     </div>
//                                                     {item.batches.map((batch, bIndex) => (
//                                                         <div key={bIndex} className={`batch-grid-row ${bIndex % 2 === 0 ? 'batch-grid-row-even' : ''}`}>
//                                                             <div className="batch-grid-cell">
//                                                                 {formatDate(batch.purchaseDate)}
//                                                             </div>
//                                                             <div className="batch-grid-cell">
//                                                                 <strong>{batch.qty}</strong>
//                                                             </div>
//                                                             <div className="batch-grid-cell">
//                                                                 {formatDate(batch.expiryDate)}
//                                                             </div>
//                                                             <div className="batch-grid-cell">
//                                                                 <span className={`days-badge ${batch.daysUntilExpiry <= 7 ? 'days-warning' : ''} ${batch.daysUntilExpiry <= 3 ? 'days-critical' : ''}`}>
//                                                                     {batch.daysUntilExpiry} days
//                                                                 </span>
//                                                             </div>
//                                                         </div>
//                                                     ))}
//                                                 </div>
//                                             )}
//                                         </div>
//                                     ))
//                                 )}
//                             </div>
//                         )}

//                         {activeTab === 'expiring' && (
//                             <div className="table-container">
//                                 <div className="alert-box">
//                                     ⚠️ Showing items expiring within {expiryDays} days
//                                 </div>

//                                 <div className="grid-header">
//                                     <div className="grid-cell">Item Code</div>
//                                     <div className="grid-cell">Quantity</div>
//                                     <div className="grid-cell">Purchase Date</div>
//                                     <div className="grid-cell">Expiry Date</div>
//                                     <div className="grid-cell">Days Left</div>
//                                 </div>

//                                 {expiringItems.length === 0 ? (
//                                     <div className="no-data">
//                                         ✓ No items expiring within {expiryDays} days
//                                     </div>
//                                 ) : (
//                                     expiringItems.map((item, index) => (
//                                         <div key={index} className={`grid-row ${index % 2 === 0 ? 'grid-row-even' : ''} ${item.daysUntilExpiry <= 3 ? 'grid-row-critical' : ''}`}>
//                                             <div className="grid-cell">
//                                                 <strong>{item.itemCode}</strong>
//                                             </div>
//                                             <div className="grid-cell">
//                                                 <span className="qty-badge">{item.qty}</span>
//                                             </div>
//                                             <div className="grid-cell">
//                                                 {formatDate(item.purchaseDate)}
//                                             </div>
//                                             <div className="grid-cell">
//                                                 {formatDate(item.expiryDate)}
//                                             </div>
//                                             <div className="grid-cell">
//                                                 <span className={`days-badge ${item.daysUntilExpiry <= 7 ? 'days-warning' : ''} ${item.daysUntilExpiry <= 3 ? 'days-critical' : ''}`}>
//                                                     {item.daysUntilExpiry} days
//                                                 </span>
//                                             </div>
//                                         </div>
//                                     ))
//                                 )}
//                             </div>
//                         )}
//                     </>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default StockDashboard;




import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import './Stock.css';

// Convert raw bottles → display string "Xc Yb"
// If packOf not available, just show raw number
const bottlesToDisplay = (bottles, packOf) => {
    if (!packOf || packOf <= 1) return `${bottles}`;
    const cases = Math.floor(bottles / packOf);
    const remainingBottles = bottles % packOf;
    if (cases === 0) return `${remainingBottles}b`;
    if (remainingBottles === 0) return `${cases}c`;
    return `${cases}c ${remainingBottles}b`;
};

const StockDashboard = () => {
    const [stockData, setStockData] = useState([]);
    const [expiringItems, setExpiringItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stock');
    const [searchTerm, setSearchTerm] = useState('');
    const [expiryDays, setExpiryDays] = useState(30);
    const [expandedItem, setExpandedItem] = useState(null);

    const fetchStock = async () => {
        setLoading(true);
        try {
            const response = await api.get('/stock');
            if (response?.data?.success) {
                setStockData(response?.data?.data);
            }
        } catch (error) {
            console.error('Error fetching stock:', error);
        }
        setLoading(false);
    };

    const fetchExpiringItems = async () => {
        try {
            const response = await api.get(`/stock/expiring?days=${expiryDays}`);
            if (response?.data?.success) {
                setExpiringItems(response?.data?.data);
            }
        } catch (error) {
            console.error('Error fetching expiring items:', error);
        }
    };

    const handleCleanup = async () => {
        if (!window.confirm('Are you sure you want to cleanup expired items?')) return;
        try {
            const response = await api.post('/stock/cleanup');
            if (response?.data?.success) {
                // totalExpiredQty is now in bottles — display accordingly
                const bottles = response.data.totalExpiredQty;
                alert(`Cleanup completed! Removed ${bottles} bottle(s) of expired stock.`);
                fetchStock();
                fetchExpiringItems();
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
            alert('Cleanup failed!');
        }
    };

    useEffect(() => {
        fetchStock();
        fetchExpiringItems();
    }, []);

    useEffect(() => {
        if (activeTab === 'expiring') fetchExpiringItems();
    }, [expiryDays, activeTab]);

    const filteredStock = stockData.filter(item =>
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Total quantity across all items — in bottles, then display as raw bottles
    // (cross-item sum doesn't make sense in cases since packOf differs per item)
    const totalBottles = filteredStock.reduce((sum, item) => sum + item.totalQty, 0);

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="box">
            <div className="header">
                <h2 className="title">Stock Management Dashboard</h2>
                <button onClick={handleCleanup} className="cleanup-btn">
                    🗑️ Cleanup Expired Items
                </button>
            </div>

            <div className="table-container">
                <div className="head">
                    <input
                        type="text"
                        placeholder="Search item code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />

                    {activeTab === 'expiring' && (
                        <select
                            value={expiryDays}
                            onChange={(e) => setExpiryDays(Number(e.target.value))}
                            className="select"
                        >
                            <option value={3}>3 Days</option>
                            <option value={7}>7 Days</option>
                            <option value={15}>15 Days</option>
                            <option value={30}>30 Days</option>
                        </select>
                    )}

                    <div className="tabs">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`tab ${activeTab === 'stock' ? 'tab-active' : ''}`}
                        >
                            Current Stock
                        </button>
                        <button
                            onClick={() => setActiveTab('expiring')}
                            className={`tab ${activeTab === 'expiring' ? 'tab-active' : ''}`}
                        >
                            Expiring Soon
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading">Loading stock data...</div>
                ) : (
                    <>
                        {activeTab === 'stock' && (
                            <div className="table-container">
                                <div className="stats-bar">
                                    <div className="stat">
                                        <span className="stat-label">Total Items:</span>
                                        <span className="stat-value">{filteredStock.length}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Total Stock:</span>
                                        {/* Cross-item total shown in raw bottles since packOf differs */}
                                        <span className="stat-value">{totalBottles} bottles</span>
                                    </div>
                                </div>

                                <div className="grid-row header">
                                    <div className="grid-cell">Item Code</div>
                                    <div className="grid-cell">Total Qty</div>
                                    <div className="grid-cell">Pack Of</div>
                                    <div className="grid-cell">Batches</div>
                                    <div className="grid-cell">Nearest Expiry</div>
                                    <div className="grid-cell">Actions</div>
                                </div>

                                {filteredStock.length === 0 ? (
                                    <div className="no-data">No stock items found</div>
                                ) : (
                                    filteredStock.map((item, index) => (
                                        <div key={index}>
                                            <div className={`grid-row ${index % 2 === 0 ? 'grid-row-even' : ''}`}>
                                                <div className="grid-cell">
                                                    <strong>{item.itemCode}</strong>
                                                </div>
                                                <div className="grid-cell">
                                                    {/* Show as cases+bottles if packOf available, else raw bottles */}
                                                    <span className="qty-badge">
                                                        {bottlesToDisplay(item.totalQty, item.packOf)}
                                                    </span>
                                                </div>
                                                <div className="grid-cell">
                                                    <span className="packof-badge">
                                                        {item.packOf ? `${item.packOf}/case` : '—'}
                                                    </span>
                                                </div>
                                                <div className="grid-cell">{item.batches.length}</div>
                                                <div className="grid-cell">
                                                    {item.batches[0] && (
                                                        <span className={`expiry-badge ${item.batches[0].daysUntilExpiry <= 7 ? 'expiry-warning' : ''}`}>
                                                            {formatDate(item.batches[0].expiryDate)}
                                                            <br />
                                                            ({item.batches[0].daysUntilExpiry} days)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid-cell">
                                                    <button
                                                        onClick={() => setExpandedItem(expandedItem === item.itemCode ? null : item.itemCode)}
                                                        className="view-btn"
                                                    >
                                                        {expandedItem === item.itemCode ? '▲ Hide' : '▼ Batches'}
                                                    </button>
                                                </div>
                                            </div>

                                            {expandedItem === item.itemCode && (
                                                <div className="batches-container">
                                                    <h4 className="batches-title">Batches for {item.itemCode}</h4>
                                                    <div className="batch-grid-header">
                                                        <div className="batch-grid-cell">Purchase Date</div>
                                                        <div className="batch-grid-cell">Quantity</div>
                                                        <div className="batch-grid-cell">Expiry Date</div>
                                                        <div className="batch-grid-cell">Days Until Expiry</div>
                                                    </div>
                                                    {item.batches.map((batch, bIndex) => (
                                                        <div
                                                            key={bIndex}
                                                            className={`batch-grid-row ${bIndex % 2 === 0 ? 'batch-grid-row-even' : ''}`}
                                                        >
                                                            <div className="batch-grid-cell">
                                                                {formatDate(batch.purchaseDate)}
                                                            </div>
                                                            <div className="batch-grid-cell">
                                                                {/* batch.qty is in bottles */}
                                                                <strong>{bottlesToDisplay(batch.qtyBottles, item.packOf)}</strong>
                                                            </div>
                                                            <div className="batch-grid-cell">
                                                                {formatDate(batch.expiryDate)}
                                                            </div>
                                                            <div className="batch-grid-cell">
                                                                <span className={`days-badge ${batch.daysUntilExpiry <= 7 ? 'days-warning' : ''} ${batch.daysUntilExpiry <= 3 ? 'days-critical' : ''}`}>
                                                                    {batch.daysUntilExpiry} days
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'expiring' && (
                            <div className="table-container">
                                <div className="alert-box">
                                    ⚠️ Showing items expiring within {expiryDays} days
                                </div>

                                <div className="grid-header expiring-grid">
                                    <div className="grid-cell">Item Code</div>
                                    <div className="grid-cell">Quantity</div>
                                    <div className="grid-cell">Purchase Date</div>
                                    <div className="grid-cell">Expiry Date</div>
                                    <div className="grid-cell">Days Left</div>
                                </div>

                                {expiringItems.length === 0 ? (
                                    <div className="no-data">
                                        ✓ No items expiring within {expiryDays} days
                                    </div>
                                ) : (
                                    expiringItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className={`grid-row expiring-grid ${index % 2 === 0 ? 'grid-row-even' : ''} ${item.daysUntilExpiry <= 3 ? 'grid-row-critical' : ''}`}
                                        >
                                            <div className="grid-cell">
                                                <strong>{item.itemCode}</strong>
                                            </div>
                                            <div className="grid-cell">
                                                {/* item.qty is in bottles; packOf may or may not be returned */}
                                                <span className="qty-badge">
                                                    {bottlesToDisplay(item.qty, item.packOf)}
                                                </span>
                                            </div>
                                            <div className="grid-cell">
                                                {formatDate(item.purchaseDate)}
                                            </div>
                                            <div className="grid-cell">
                                                {formatDate(item.expiryDate)}
                                            </div>
                                            <div className="grid-cell">
                                                <span className={`days-badge ${item.daysUntilExpiry <= 7 ? 'days-warning' : ''} ${item.daysUntilExpiry <= 3 ? 'days-critical' : ''}`}>
                                                    {item.daysUntilExpiry} days
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StockDashboard;