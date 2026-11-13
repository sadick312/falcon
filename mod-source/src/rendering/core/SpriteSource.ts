import Menu from "@menu/Menu";

/** Where the official MooMoo.io pictures are; the original Falcon (on sandbox.moomoo.io) drew these. */
const OFFICIAL_IMG = "https://moomoo.io/img";

/**
 * Loads a game picture (`folder` under img/, e.g. "hats", and its file name) for drawing on the game canvas.
 *
 * sandbox.moomodding.io serves its own redrawn hats, accessories and weapons under the same names. With
 * "Original MooMoo Artwork" (Visual, on by default) we draw the official pictures there instead, like the
 * original Falcon on sandbox.moomoo.io. moomoo.io sends no CORS header, so those images load without
 * `crossOrigin`: they draw fine, but a canvas they are drawn on can't be read back. Only the game canvas
 * uses them and nothing reads its pixels (the hotbar icons, which are read back, keep the site's pictures).
 */
export function loadGameSprite(
    folder: string,
    file: string,
    hostname = location.hostname,
    useOriginal: boolean = Menu.getValue("originalArtwork") !== false
) {
    const image = new Image();
    if (hostname.endsWith("moomodding.io") && useOriginal) {
        // If moomoo.io can't be reached (down, blocked, missing file), fall back to the site's own
        // picture once instead of drawing nothing. Callers only set onload, so this stays ours.
        image.onerror = () => {
            image.onerror = null;
            image.crossOrigin = "anonymous";
            image.src = `../../img/${folder}/${file}`;
        };
        image.src = `${OFFICIAL_IMG}/${folder}/${file}`;
    } else {
        image.crossOrigin = "anonymous";
        image.src = `../../img/${folder}/${file}`;
    }
    return image;
}
