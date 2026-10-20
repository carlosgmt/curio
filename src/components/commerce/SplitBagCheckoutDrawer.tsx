"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Loader2,
  Tag,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "@/lib/apiClient";
import type { SplitCheckoutResult } from "@/lib/commerce/splitCheckout";

export interface SplitBagCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string;
  boardTitle?: string;
  initialSession?: SplitCheckoutResult | null;
}

export function SplitBagCheckoutDrawer({
  isOpen,
  onClose,
  boardId,
  boardTitle,
  initialSession = null,
}: SplitBagCheckoutDrawerProps) {
  const [session, setSession] = useState<SplitCheckoutResult | null>(initialSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
    }
  }, [initialSession]);

  useEffect(() => {
    if (!isOpen || session || !boardId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch("/api/v1/commerce/split-checkout", {
      method: "POST",
      body: JSON.stringify({ boardId }),
    })
      .then((res) => res.json())
      .then((data: any) => {
        if (!isMounted) return;
        if (data?.session) {
          setSession(data.session);
        } else {
          setError(data?.error || "Failed to load split checkout session");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to initialize checkout");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, boardId, session]);

  const formatPrice = (cents: number | null | undefined, currency = "USD") => {
    if (cents == null) return "Check Store";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const handleInstantPay = () => {
    if (session?.checkoutUrl) {
      window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleAffiliateClick = (item: SplitCheckoutResult["affiliateItems"][0]) => {
    const redirectUrl = `/api/v1/commerce/redirect?url=${encodeURIComponent(
      item.affiliateAttributedUrl || item.destinationUrl
    )}&curatorId=${encodeURIComponent(session?.curatorId || "")}&saveId=${encodeURIComponent(
      item.saveId
    )}&seller=${encodeURIComponent(item.sellerName)}`;

    window.open(redirectUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-screen max-w-md bg-stone-900 border-l border-stone-800 text-stone-100 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-serif font-medium tracking-tight">
                      Split-Bag Checkout
                    </h2>
                    {boardTitle && (
                      <p className="text-xs text-stone-400 truncate max-w-[240px]">
                        {boardTitle}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 text-stone-400 space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <p className="text-xs">Partitioning UCP & Affiliate items...</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                    {error}
                  </div>
                )}

                {!loading && session && (
                  <>
                    {/* SECTION 1: Consolidated UCP Instant Checkout */}
                    {session.ucpLineItems.length > 0 ? (
                      <div className="rounded-2xl bg-stone-950/60 border border-stone-800 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              UCP Direct
                            </span>
                            <span className="text-xs text-stone-400">
                              {session.ucpLineItems.length} item
                              {session.ucpLineItems.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-sm font-semibold font-mono text-stone-100">
                            {formatPrice(session.totalCents, session.currency)}
                          </div>
                        </div>

                        {/* Line items list */}
                        <div className="divide-y divide-stone-800/60">
                          {session.ucpLineItems.map((item, idx) => (
                            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-3 truncate mr-2">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    className="w-9 h-9 rounded object-cover bg-stone-800 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded bg-stone-800 flex items-center justify-center text-stone-500 flex-shrink-0">
                                    <Store className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="truncate">
                                  <p className="text-stone-200 font-medium truncate">{item.title}</p>
                                  <p className="text-[11px] text-stone-500">{item.sellerName}</p>
                                </div>
                              </div>
                              <span className="font-mono text-stone-300 flex-shrink-0">
                                {formatPrice(item.priceCents, item.currency)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Instant Google Pay Button */}
                        <button
                          onClick={handleInstantPay}
                          className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-white text-stone-900 font-medium text-xs flex items-center justify-center space-x-2 shadow-lg transition-colors"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>1-Click Pay with Google Pay</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-stone-800/30 border border-stone-800 text-stone-400 text-xs text-center">
                        No direct UCP items on this board.
                      </div>
                    )}

                    {/* SECTION 2: Direct Retailer & Affiliate Links */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-300">
                            Merchant Direct Offers ({session.affiliateItems.length})
                          </h3>
                        </div>
                        <span className="text-[10px] text-stone-500 font-mono">
                          Creator Attributed
                        </span>
                      </div>

                      {session.affiliateItems.length === 0 ? (
                        <p className="text-xs text-stone-500">No external merchant items.</p>
                      ) : (
                        <div className="space-y-2">
                          {session.affiliateItems.map((item) => (
                            <div
                              key={item.saveId}
                              className="p-3 rounded-xl bg-stone-950/40 border border-stone-800/80 hover:border-stone-700 transition-colors flex items-center justify-between text-xs"
                            >
                              <div className="truncate mr-3">
                                <p className="text-stone-200 font-medium truncate">{item.title}</p>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <span className="text-[11px] text-stone-400">
                                    {item.sellerName}
                                  </span>
                                  {item.priceCents != null && (
                                    <>
                                      <span className="text-stone-600">•</span>
                                      <span className="font-mono text-stone-300">
                                        {formatPrice(item.priceCents)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleAffiliateClick(item)}
                                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium inline-flex items-center space-x-1 transition-colors flex-shrink-0"
                              >
                                <span>Buy</span>
                                <ExternalLink className="w-3 h-3 text-stone-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-stone-800/80 bg-stone-950/40 text-[11px] text-stone-500 flex items-center justify-between">
                <span>Universal Commerce Protocol v1.0</span>
                <span className="font-mono">BYOT Active</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
