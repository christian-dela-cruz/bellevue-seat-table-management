const fs = require('fs');

const targetFile = 'c:/Users/Christian/seat-table-mngmnt/frontend/src/features/admin/pages/ReservationDashboard.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

const injectionTarget = `                    </div>
                  </div>

                </div>

                {/* Right Column: Actions, Allocation, History */}`;

const injectionContent = `                    </div>
                  </div>

                  {/* Internal Pricing Card */}
                  <div style={{
                    background: C.surfaceInput,
                    border: \`1px solid \${C.borderDefault}\`,
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <SectionLabel style={{margin:0}}>Internal Pricing</SectionLabel>
                      {canManage && (
                        <button
                          onClick={() => setIsEditingPricing(!isEditingPricing)}
                          style={{
                            background:"transparent",border:"none",color:C.gold,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"
                          }}
                        >
                          {isEditingPricing ? "Cancel" : "Edit"}
                        </button>
                      )}
                    </div>
                    
                    {isEditingPricing ? (
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Pricing Mode</label>
                          <select
                            value={pricingForm.pricing_mode}
                            onChange={(e)=>setPricingForm({...pricingForm, pricing_mode:e.target.value})}
                            style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}}
                          >
                            <option value="">None</option>
                            <option value="fixed">Fixed Price</option>
                            <option value="per_person">Per Person</option>
                            <option value="per_seat">Per Seat</option>
                            <option value="package">Package</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        
                        {(pricingForm.pricing_mode === "fixed" || pricingForm.pricing_mode === "custom") && (
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Base Price</label>
                            <input type="number" min="0" value={pricingForm.base_price} onChange={(e)=>setPricingForm({...pricingForm, base_price:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                          </div>
                        )}
                        
                        {pricingForm.pricing_mode === "per_person" && (
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Price Per Person</label>
                            <input type="number" min="0" value={pricingForm.price_per_person} onChange={(e)=>setPricingForm({...pricingForm, price_per_person:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                          </div>
                        )}
                        
                        {pricingForm.pricing_mode === "per_seat" && (
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Price Per Seat</label>
                            <input type="number" min="0" value={pricingForm.price_per_seat} onChange={(e)=>setPricingForm({...pricingForm, price_per_seat:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                          </div>
                        )}
                        
                        {pricingForm.pricing_mode === "package" && (
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Package Name</label>
                              <input type="text" value={pricingForm.package_name} onChange={(e)=>setPricingForm({...pricingForm, package_name:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Package Price</label>
                              <input type="number" min="0" value={pricingForm.package_price} onChange={(e)=>setPricingForm({...pricingForm, package_price:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                            </div>
                          </div>
                        )}

                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Manual Price Override</label>
                          <input type="number" min="0" placeholder="Optional override" value={pricingForm.manual_price_override} onChange={(e)=>setPricingForm({...pricingForm, manual_price_override:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%"}} />
                        </div>
                        
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Notes</label>
                          <textarea value={pricingForm.price_notes} onChange={(e)=>setPricingForm({...pricingForm, price_notes:e.target.value})} style={{...editInputStyle(false), padding:"8px 10px", fontSize:12, width:"100%", minHeight:60}} />
                        </div>

                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                          <input type="checkbox" id="show_guest" checked={pricingForm.show_price_to_guest} onChange={(e)=>setPricingForm({...pricingForm, show_price_to_guest:e.target.checked})} />
                          <label htmlFor="show_guest" style={{fontFamily:F.body,fontSize:12,color:C.textPrimary,cursor:"pointer"}}>Show Estimated Price to Guest</label>
                        </div>

                        <button
                          onClick={handlePricingSave}
                          disabled={pricingLoading}
                          style={{
                            marginTop:8,padding:"10px",background:C.gold,border:"none",borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",cursor:pricingLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7
                          }}
                        >
                          {pricingLoading ? <Spinner/> : "Save Pricing"}
                        </button>
                      </div>
                    ) : (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"10px 20px"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:4,padding:"6px 0",borderBottom:\`1px solid \${C.divider}\`}}>
                          <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Mode</span>
                          <span style={{fontFamily:F.body,fontSize:12.5,color:C.textPrimary,fontWeight:500}}>{reservation.pricing_mode ? reservation.pricing_mode.replace("_"," ").toUpperCase() : "NONE"}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4,padding:"6px 0",borderBottom:\`1px solid \${C.divider}\`}}>
                          <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Final Price</span>
                          <span style={{fontFamily:F.body,fontSize:12.5,color:C.gold,fontWeight:700}}>PHP {Number(reservation.manual_price_override || reservation.calculated_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4,padding:"6px 0",borderBottom:\`1px solid \${C.divider}\`,gridColumn:"span 2"}}>
                          <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Visibility</span>
                          <span style={{fontFamily:F.body,fontSize:12.5,color:C.textPrimary,fontWeight:500}}>{reservation.show_price_to_guest ? "Visible to Guest" : "Hidden"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Column: Actions, Allocation, History */}`;

if (content.includes(injectionTarget)) {
  content = content.replace(injectionTarget, injectionContent);
  fs.writeFileSync(targetFile, content);
  console.log("Injected pricing UI");
} else {
  console.log("Injection target not found");
}
