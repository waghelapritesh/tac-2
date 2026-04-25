/**
 * Re-export native clipboard utilities from @tac/native.
 *
 * This module exists for backward compatibility. Prefer importing
 * directly from "@tac/native/clipboard" in new code.
 */
export {
	copyToClipboard,
	readTextFromClipboard,
	readImageFromClipboard,
} from "@tac/native/clipboard";
