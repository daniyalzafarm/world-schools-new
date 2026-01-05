'use client'

import React from 'react'
import {
  Accordion,
  AccordionItem,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/react'
import { Building, FileCheck, HelpCircle, Star } from 'lucide-react'

/**
 * HowScoringWorks Component
 *
 * Expandable modal explaining trust score calculation rules, formulas, and examples.
 * Features:
 * - Detailed breakdown of all scoring categories
 * - Mathematical formulas for each factor
 * - Real-world examples
 * - Thresholds and requirements
 * - Keyboard accessible
 */
export function HowScoringWorks() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  return (
    <>
      <Button variant="light" size="sm" isIconOnly onPress={onOpen}>
        <HelpCircle className="h-5 w-5 text-default-400" />
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[90vh]',
          body: 'py-6',
          wrapper: 'z-[9999]',
          backdrop: 'z-[9998] bg-black/50',
        }}
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-foreground">How Trust Score Works</h2>
                <p className="text-sm font-normal text-default-500">
                  Understanding how your trust score is calculated
                </p>
              </ModalHeader>
              <ModalBody>
                {/* Scoring Categories */}
                <Accordion variant="bordered" selectionMode="multiple">
                  {/* Step 1: Find Your Camp */}
                  <AccordionItem
                    key="google"
                    aria-label="Step 1: Find Your Camp"
                    title={
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-warning" />
                        <span className="font-semibold">Step 1: Find Your Camp (up to 30 pts)</span>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="mb-2 font-semibold text-foreground">Components:</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                          <span className="font-semibold text-primary">10 pts:</span>
                          <span>Having a verified Google Business Profile</span>

                          <span className="font-semibold text-primary">0-15 pts:</span>
                          <div>
                            <div>Google star rating</div>
                            <div className="mt-1 text-default-500">
                              Formula:{' '}
                              <code className="rounded bg-default-100 px-1">(rating ÷ 5) × 15</code>
                            </div>
                          </div>

                          <span className="font-semibold text-primary">0-5 pts:</span>
                          <div>
                            <div>Number of Google reviews</div>
                            <div className="mt-1 text-default-500">
                              Formula:{' '}
                              <code className="rounded bg-default-100 px-1">
                                min(5, floor(reviews ÷ 10))
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-default-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">Examples:</h4>
                        <ul className="space-y-1 text-sm text-default-600">
                          <li>
                            • 4.5★ rating with 25 reviews = 10 + 14 + 2 = <strong>26 points</strong>
                          </li>
                          <li>
                            • 5.0★ rating with 50+ reviews = 10 + 15 + 5 ={' '}
                            <strong>30 points</strong>
                          </li>
                          <li>
                            • 3.0★ rating with 5 reviews = 10 + 9 + 0 = <strong>19 points</strong>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </AccordionItem>

                  {/* Step 2: Contact & Account (Legal Information + Business Age) */}
                  <AccordionItem
                    key="contact-account"
                    aria-label="Step 2: Contact & Account"
                    title={
                      <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-success" />
                        <span className="font-semibold">
                          Step 2: Contact & Account (up to 30 pts)
                        </span>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="mb-2 font-semibold text-foreground">Components:</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                          <span className="font-semibold text-primary">15 pts:</span>
                          <div>
                            <div>Complete Legal Information</div>
                            <div className="mt-1 text-default-500">
                              Requires: Legal company name, street address, and city
                            </div>
                          </div>

                          <span className="font-semibold text-primary">0-15 pts:</span>
                          <div>
                            <div>Business Age</div>
                            <div className="mt-1 text-default-500">
                              5 pts: 2-4 years | 10 pts: 5-9 years | 15 pts: 10+ years
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-default-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Requirements:
                        </h4>
                        <ul className="space-y-1 text-sm text-default-600">
                          <li>• Legal name must match business registration</li>
                          <li>• Address must be complete and valid</li>
                          <li>• All three fields (name, address, city) are required</li>
                          <li>
                            • Business age calculated from "Year Founded" field (current year - year
                            founded)
                          </li>
                        </ul>
                      </div>
                    </div>
                  </AccordionItem>

                  {/* Step 3: About Your Camp */}
                  <AccordionItem
                    key="camp-profile"
                    aria-label="Step 3: About Your Camp"
                    title={
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-primary" />
                        <span className="font-semibold">
                          Step 3: About Your Camp (up to 10 pts)
                        </span>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="mb-2 font-semibold text-foreground">Components:</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                          <span className="font-semibold text-primary">4 pts:</span>
                          <div>
                            <div>Description Quality</div>
                            <div className="mt-1 text-default-500">
                              Camp description between 100-300 characters
                            </div>
                          </div>

                          <span className="font-semibold text-primary">2 pts:</span>
                          <div>
                            <div>Camp Type Selected</div>
                            <div className="mt-1 text-default-500">
                              Day camp, overnight camp, or both
                            </div>
                          </div>

                          <span className="font-semibold text-primary">4 pts:</span>
                          <div>
                            <div>Age Range Defined</div>
                            <div className="mt-1 text-default-500">
                              Minimum and maximum camper ages specified (minAge &lt; maxAge)
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-default-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Why This Matters:
                        </h4>
                        <ul className="space-y-1 text-sm text-default-600">
                          <li>• Complete profiles help families find the right camp</li>
                          <li>• Clear descriptions build trust and set expectations</li>
                          <li>• Age ranges ensure appropriate program matching</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionItem>

                  {/* Step 4: Verification */}
                  <AccordionItem
                    key="documents"
                    aria-label="Step 4: Verification"
                    title={
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-danger" />
                        <span className="font-semibold">Step 4: Verification (up to 20 pts)</span>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="mb-2 font-semibold text-foreground">Components:</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                          <span className="font-semibold text-primary">10 pts:</span>
                          <div>
                            <div>Business Registration Document</div>
                            <div className="mt-1 text-default-500">
                              Upload your business registration or incorporation documents
                            </div>
                          </div>

                          <span className="font-semibold text-primary">10 pts:</span>
                          <div>
                            <div>Insurance Certificate</div>
                            <div className="mt-1 text-default-500">
                              Upload valid liability insurance certificate
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-default-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Important Notes:
                        </h4>
                        <ul className="space-y-1 text-sm text-default-600">
                          <li>• Points awarded immediately upon upload</li>
                          <li>• Documents will be reviewed by our team</li>
                          <li>• Invalid documents may affect final approval</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionItem>

                  {/* Step 5: Payment & Policies */}
                  <AccordionItem
                    key="policies"
                    aria-label="Step 5: Payment & Policies"
                    title={
                      <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-warning" />
                        <span className="font-semibold">
                          Step 5: Payment & Policies (up to 10 pts)
                        </span>
                      </div>
                    }
                  >
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="mb-2 font-semibold text-foreground">Components:</h4>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                          <span className="font-semibold text-primary">5 pts:</span>
                          <div>
                            <div>Deposit Configured</div>
                            <div className="mt-1 text-default-500">
                              Deposit requirement and amount set (percentage or fixed)
                            </div>
                          </div>

                          <span className="font-semibold text-primary">0-5 pts:</span>
                          <div>
                            <div>Cancellation Policy</div>
                            <div className="mt-1 text-default-500">
                              Flexible: 5 pts | Moderate: 3 pts | Strict: 2 pts
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-default-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Policy Impact:
                        </h4>
                        <ul className="space-y-1 text-sm text-default-600">
                          <li>• Flexible policies earn more points (customer-friendly)</li>
                          <li>• Clear payment terms reduce booking friction</li>
                          <li>• Transparent policies build family confidence</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionItem>
                </Accordion>

                {/* Score Thresholds */}
                {/* <div className="mt-6 rounded-lg border border-default-200 p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Approval Thresholds</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-success-50 p-2">
                      <span className="font-medium text-success-700">80-100 points</span>
                      <span className="text-success-600">Auto-approved</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-warning-50 p-2">
                      <span className="font-medium text-warning-700">50-79 points</span>
                      <span className="text-warning-600">Manual review required</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-danger-50 p-2">
                      <span className="font-medium text-danger-700">0-49 points</span>
                      <span className="text-danger-600">Additional verification needed</span>
                    </div>
                  </div>
                </div> */}

                {/* Tips */}
                <div className="mt-6 rounded-lg bg-primary-50 p-4">
                  <h3 className="mb-2 font-semibold text-secondary">Tips to Maximize Your Score</h3>
                  <ul className="space-y-1 text-sm text-default-700">
                    <li>• Claim and verify your Google Business Profile (Step 1)</li>
                    <li>• Encourage satisfied families to leave Google reviews (Step 1)</li>
                    <li>• Complete all legal information accurately (Step 2)</li>
                    <li>• Write a clear, detailed camp description (Step 3)</li>
                    <li>• Upload all required documents promptly (Step 4)</li>
                    <li>• Configure deposit and cancellation policies (Step 5)</li>
                    <li>• Choose flexible policies for higher scores (Step 5)</li>
                  </ul>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  Got it
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
