// @ts-nocheck
/**
 * One monitoring row per CE family. Used only when features.monitoringFamilies === true.
 * Flag off keeps foldMonitoringRows. This does not change stored rows.
 */
import { combinedTotal, familyKey, parseCeNumber, suffixTags, URGENT_TAG } from "./docSuffixes.js";

function closed(status) {
	const key = String(status || "").trim().toLowerCase();
	return key === "done" || key === "cancelled" || key === "canceled" || key === "close bid" || key === "closed bid" || key === "no quote";
}

function memberTags(row) {
	const tags = suffixTags(row?.ceId || row?.ceDisplay || "");
	if (row?.urgentTag && !tags.includes(URGENT_TAG)) tags.push(URGENT_TAG);
	return tags;
}

/** The account id that currently holds an approval step. A used backup wins. */
export function holderId(row) {
	const steps = row?.steps || row?.approval?.steps || [];
	const index = Number(row?.currentIndex ?? row?.approval?.currentIndex ?? 0);
	const step = steps[index] || {};
	if (step.usedBackup && step.backupUserId) return String(step.backupUserId);
	return String(step.userId || "");
}

/**
 * @param {unknown[]} rows
 */
export function foldFamilyRows(rows) {
	const groups = new Map();
	(rows || []).forEach((row) => {
		const key = familyKey(row?.ceId || row?.ceDisplay || row?.id);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(row);
	});
	return [...groups.values()].map((members) => {
		const ranked = members.slice().sort((a, b) => (b.revRank || 0) - (a.revRank || 0));
		const originals = ranked.filter((row) => {
			const parsed = parseCeNumber(row.ceId || row.ceDisplay);
			return parsed.ok && !parsed.letter && !parsed.addendum && !parsed.update;
		});
		const live = originals.find((row) => !closed(row.status)) || originals[0] || ranked.find((row) => !closed(row.status)) || ranked[0];
		const tags = [];
		members.forEach((row) => {
			memberTags(row).forEach((tag) => {
				if (!tags.includes(tag)) tags.push(tag);
			});
		});
		const amounts = members.map((row) => ({
			id: row.ceId || row.ceDisplay,
			amount: row.amountValue != null ? row.amountValue : row.amount,
			status: row.status,
			awardStatus: row.awardStatus
		}));
		return {
			...live,
			id: `ce-family-${familyKey(live.ceId || live.ceDisplay || live.id)}`,
			family: true,
			familyTags: tags,
			familyMembers: members.map((row) => ({
				id: row.ceId || row.id,
				ceDisplay: row.ceDisplay || row.ceId || row.id,
				status: row.status || "",
				awardStatus: row.awardStatus || "",
				amount: row.amount || "",
				tags: memberTags(row)
			})),
			combinedAmount: combinedTotal(amounts)
		};
	});
}
