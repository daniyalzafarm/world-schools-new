 Here's a summary of the 108 "To fix" tasks across the board, grouped by app.
                                                                                          
  Status breakdown                                                                        
                                                                                                                                                   
  - To fix: 108 (this list)                                                                                                                        
  - Done: ~40 · Under Discussion: 4 · Can't Reproduce: 2 · Duplicated: 1 · In progress / Won't fix: 0                                              
                                                                                                                                                   
  Admin (~17 To-fix)                                                                                                                               
                                                                                                                                                   
  SuperAdmin Analytics Dashboard (the 2026-06-03 QA batch — all in this list)                                                                      
  - Booking Status donut: legend % misaligned (BUG-125, High)
  - Donut hover tooltip missing GMV (BUG-126, Med)                                                                                                 
  - KPI cards: no previous-period value (BUG-127, Med)
  - KPI trend "↑100%" div-by-zero (BUG-130, Low)                                                                                                   
  - No custom date range picker (BUG-129, Med)                                                                                                     
  - Geographic Distribution omits UK (BUG-123, Med)                                                                                                
                                                                                                                                                   
  Compliance / Support                                                                                                                             
  - Reported conversations not actionable in SuperAdmin — DSA/NetzDG (Critical)
  - Broken full-pink error screen on invalid URL (High)                                                                                            
  - BUG-016 Verification Docs page doesn't reflect review decisions (High)
  - BUG-018 Can't approve doc after requesting reupload (High)                                                                                     
  - Support: no badge counter on new tickets (High)                                                                                                
  - Ticket workflow simplification + design validation (Med)                                                                                       
  - Booking-accepted notifications show parent-facing copy (Med)                                                                                   
  - Document buttons "View"/"Review" ambiguous (Low)                                                                                               
  - Operational status labels lack tooltips (BUG-120, Med)
                                                                                                                                                   
  Provider (~45 To-fix)
                                                                                                                                                   
  Critical        
  - Camp can accept an expired booking — triggers card capture on expired auth (BUG-116)                                                           
  - BUG-011 Consent says 10% service fee, should be 12.5% (legal)                                                                                  
  - Report-conversation fails with permission error              
  - Chat: conversation stays unread, typing indicator missing, messages not grouped by sender, context menu missing                                
                  
  High-volume themes                                                                                                                               
  - Verification docs: BUG-015 / BUG-017 / BUG-019 (reupload + notification flow broken)
  - Sessions/pricing: BUG-023 date input, BUG-024 / BUG-035 wrong currency, BUG-026 sibling discount broken, BUG-029 silent save                   
  - Camp editor: BUG-043 What's Included hierarchy, BUG-045/046 Skills picker, BUG-048 Getting There blocks Next, Philosophy options irrelevant,
  low-contrast nav, Logo treated as camp photo                                                                                                     
  - Provider Bookings: 20 of 26 screens 404; BUG-BK-01/02/03/05/08/09 detail-panel gaps, sticky footer, payout progress, kebab, Export no-op,      
  BUG-114/115/118 expired+wrong-status+decline reasons                                                                                             
  - Provider Messages: BUG-MSG-04/05 filter tabs wrong, last-message preview, status tag, top-bar clickable                                        
  - Dashboard: BUG-124 date-range filter, notifications missing for new requests, stale badge counts       
  - Misc: ToS link mismatch, consent link missing, char-limit toasts, Programs/Activities Skip missing, Spots Available ambiguity,                 
  accept-no-confirmation step                                                                                                                      
                                                                                                                                                   
  Parent (~46 To-fix)                                                                                                                              
                                                                                                                                                   
  Critical                                                                                                                                         
  - Any child can be added to a booking without confirming legal guardianship (safeguarding)
  - 75% profile completion not enforced server-side                                                                                                
  - Child photo upload — GDPR / revDSG concerns    
  - Consent spec v1.0 (4 checkboxes) not implemented                                                                                               
  - Messages to different camps from same provider merged into one conversation
  - Sending message from camp profile doesn't create thread                                                                                        
  - Booking detail: Cancel Booking button missing (two duplicates)                                                                                 
  - Camp profile sidebar improvements (design)                                                                                                     
                                                                                                                                                   
  High-volume themes
  - Booking detail: page fails to load, shows operator address not camp, currency shows USD $10,100 instead of GBP/CHF, BUG-BK-10 cancel absent,   
  BUG-BK-12 upload disabled, BUG-BK-13 Leave review missing                                                                                        
  - Messages: BUG-MSG-01/09, VIS-MSG-01 bubble alignment, BUG-008 wrong thread header, BUG-BK-07/11 message routed to list, BUG-006 camp identity
  missing, provider/camp logo missing                                                                                                              
  - Child profiles: nav context lost, no privacy notice, Languages/Mother-tongue fields, Interests pronoun, country/nationality dropdowns no search
   + overlap, Help Center empty                                                                                                                    
  - Booking flow: no confirmation before submit, trust card not interactive, draft persistence, BUG-BK-04 "Need more time?" no-op, cancellation    
  policy date/full-policy link missing, free-cancellation copy vague, Submit Report button maroon                                              
  - Auth: modal redirects, Reserve while logged-out redirects                                                                                      
  - Wishlist: "World-Schools" typo, compare button icon unclear, generic compare CTA, Stats icon no action
  - BUG-03 No edit button next to email (High)                                                                                                     
                                                                                                                                                   
  Recommended next moves
                                                                                                                                                   
  1. Triage the 9 Critical entries first — most are safeguarding/legal/compliance (guardianship check, GDPR child photo, 12.5% fee copy, DSA       
  reporting). These are higher impact than the SuperAdmin analytics polish.
  2. Provider Bookings is the single biggest functional gap (20/26 screens 404 + many BK-** bugs) — likely one focused sprint.                     
  3. Chat / Messages Critical bugs span both Provider and Parent sides — fix together since they share the same conversation model.                
                                                                                                                                                   
  Want me to drill into a specific cluster (e.g. all Critical items, or just Provider Bookings) with full per-item detail?  