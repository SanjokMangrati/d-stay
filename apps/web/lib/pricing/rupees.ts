import { pricingUpdateRoomRatesBodyBaseRateMax } from "@d-stay/api-client/schemas/pricing";
import { PAISE_PER_RUPEE } from "@d-stay/domain/money";
import { z } from "zod";

/**
 * Every rate form works in rupees, because that is what a host says out loud,
 * and converts at submit. The generated schemas are in paise and stay the
 * authority on the bounds — these are the same numbers divided by a hundred.
 */
export const MAX_RATE_RUPEES = pricingUpdateRoomRatesBodyBaseRateMax / PAISE_PER_RUPEE;

export const rupeeAmount = z.number().min(0).max(MAX_RATE_RUPEES);

/**
 * An empty optional amount is the host saying "no rate here", not the number
 * zero — a blank weekend rate means weekends cost the base rate, while a zero
 * one would mean the room is free on a Saturday.
 */
export const optionalRupeeAmount = rupeeAmount.nullable();
