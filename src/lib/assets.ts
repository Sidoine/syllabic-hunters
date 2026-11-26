/** URL for a file synchronized from the Seafile Hunters library. */
export function assetUrl(relativePath: string) {
	return `/assets/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
