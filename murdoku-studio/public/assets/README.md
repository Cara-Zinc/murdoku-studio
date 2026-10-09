# Visual assets

`suspects-atlas.png` is an original six-character illustration generated with the built-in `imagegen` tool for this project. It is used only for the original practice case; imported cases use portraits cropped from their own source page when available, with letter identifiers as a fallback. The atlas has three columns and two rows. Keep its aspect ratio at 3:2 and each portrait viewport square.

Generation prompt:

> Use case: illustration-story. Asset type: original suspect portrait atlas for a cozy murder-mystery logic game UI. Create a single image with EXACTLY six portraits in a perfectly even 3-column by 2-row grid, edge-to-edge square tiles, no gaps, no margins, no lettering, no frames. Landscape 3:2 aspect ratio. Each tile contains exactly one centered bust, head fully visible with 12% headroom, shoulders cropped at lower edge of tile. Clean hand-inked flat 2D cartoon, thick near-black contour lines, flat muted jewel colors, simplified featureless faces (no eyes, nose or mouth), no gradients, no texture, no photorealism. Original character designs: top-left woman with dark straight bob and ochre sweater on burnt-red background; top-middle man with wavy brown hair and forest-green jacket on sea-blue background; top-right man with short black hair and round glasses and slate-blue shirt on muted olive background; bottom-left woman with swept-back dark auburn hair and ivory shirt on cornflower-blue background; bottom-middle man with silver side-parted hair and burgundy sweater on plum background; bottom-right man with dark curly hair and dark-blue cardigan on faded rose background. All six portraits at the same scale and alignment. The artwork should resemble printed character tokens from an illustrated detective board game, with distinctive silhouettes and strong readable shapes. No existing licensed characters, no logos, no numbers, no writing.

`caveat.ttf` is Caveat Bold, served locally from Google Fonts. It supplies handwritten Latin letters and names; Chinese text uses the system's KaiTi or cursive fallback when available. Font license: [Caveat-OFL.txt](Caveat-OFL.txt), SIL Open Font License 1.1.

Font source: `https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjRV6SII.ttf`.

The visual direction references the public Murdoku online interface: pale paper surfaces, black borders, offset shadows, portrait/name/clue cards, blue selection outlines, and yellow action buttons. Official character artwork and stylesheets are not bundled. The independent implementation is in `../game-theme.css`.
