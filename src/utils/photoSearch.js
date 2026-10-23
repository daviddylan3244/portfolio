const REGION_EXPAND = {
    pr: ['Puerto Rico', 'PR'],
    ma: ['Massachusetts', 'MA'],
    ny: ['New York', 'NYC', 'New York City', 'NY'],
    nyc: ['New York', 'NYC', 'New York City'],
    dr: ['Dominican Republic', 'DR'],
    italy: ['Italy'],
    spain: ['Spain'],
    france: ['France'],
};

const PLACE_EXPAND = {
    'new york city': ['New York', 'NYC', 'New York City'],
    'viejo san juan': ['Viejo San Juan', 'San Juan'],
    'vieques sound': ['Vieques Sound', 'Vieques'],
    'eastern sardinia': ['Eastern Sardinia', 'Sardinia', 'Italy'],
    'santo domingo': ['Santo Domingo', 'Dominican Republic'],
    condado: ['Condado', 'Puerto Rico'],
    chinatown: ['Chinatown', 'New York', 'NYC'],
    'east village': ['East Village', 'New York', 'NYC'],
    midtown: ['Midtown', 'New York', 'NYC'],
    'upper west side': ['Upper West Side', 'New York', 'NYC'],
    'orchard street': ['Orchard Street', 'New York', 'NYC'],
};

const fold = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[*_]/g, ' ')
    .replace(/[&'\u2019-]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const wordsOf = (value) => fold(value).split(/\s+/).filter(Boolean);

const uniqueTags = (list) => {
    const seen = new Set();
    const out = [];
    list.forEach((item) => {
        const text = String(item || '').trim();
        if (!text) return;
        const key = fold(text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(text);
    });
    return out;
};

const expandPlacePart = (part, tags) => {
    const raw = String(part || '').trim();
    if (!raw) return;
    tags.push(raw);
    const folded = fold(raw);
    const mapped = PLACE_EXPAND[folded];
    if (mapped) tags.push(...mapped);
    const region = REGION_EXPAND[folded];
    if (region) tags.push(...region);
};

export function automaticTagsFor(info) {
    const tags = [];
    const title = String(info?.title || '');
    const details = String(info?.details || '');
    const description = String(info?.description || '');
    const blob = `${title} ${details} ${description}`;

    if (/^jcdecaux\b/i.test(title.trim())) {
        tags.push('advertisement', 'JCDecaux');
    }
    if (/huntington news/i.test(blob)) {
        tags.push('published', 'journalism', 'Huntington News');
    }
    if (/\b35mm\b/i.test(details) || /\b120\s*film\b/i.test(details)) {
        tags.push('film');
    }
    if (/\bdigital\b/i.test(details)) {
        tags.push('digital');
    }

    const place = details.split(/\s*[·|]\s*/)[0] || '';
    place.split(/\s*,\s*/).forEach((part) => expandPlacePart(part, tags));

    return uniqueTags(tags);
}

const damerau = (a, b, max) => {
    if (a === b) return 0;
    const aLen = a.length;
    const bLen = b.length;
    if (Math.abs(aLen - bLen) > max) return max + 1;
    if (!aLen) return bLen > max ? max + 1 : bLen;
    if (!bLen) return aLen > max ? max + 1 : aLen;
    const prev = new Array(bLen + 1);
    const curr = new Array(bLen + 1);
    const older = new Array(bLen + 1);
    for (let j = 0; j <= bLen; j += 1) prev[j] = j;
    for (let i = 1; i <= aLen; i += 1) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= bLen; j += 1) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            let val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            if (
                i > 1
                && j > 1
                && a.charCodeAt(i - 1) === b.charCodeAt(j - 2)
                && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
            ) {
                val = Math.min(val, older[j - 2] + 1);
            }
            curr[j] = val;
            if (val < rowMin) rowMin = val;
        }
        if (rowMin > max) return max + 1;
        for (let j = 0; j <= bLen; j += 1) {
            older[j] = prev[j];
            prev[j] = curr[j];
        }
    }
    return prev[bLen];
};

const fuzzyLimit = (len) => {
    if (len >= 8) return 2;
    if (len >= 6) return 1;
    return 0;
};

const isNumericToken = (token) => /^\d+$/.test(token);

const tokenHitsWord = (token, word, allowFuzzy) => {
    if (!token || !word) return false;
    if (word === token || word.startsWith(token)) return true;
    if (!isNumericToken(token) && word.includes(token)) return true;
    if (!allowFuzzy) return false;
    if (token.charAt(0) !== word.charAt(0)) return false;
    const limit = fuzzyLimit(Math.max(token.length, word.length));
    if (!limit) return false;
    if (Math.abs(token.length - word.length) > limit) return false;
    return damerau(token, word, limit) <= limit;
};

const tokenHitsRecord = (token, record) => {
    if (!token) return true;
    if (!isNumericToken(token) && record.haystack.includes(token)) return true;
    for (let i = 0; i < record.words.length; i += 1) {
        if (tokenHitsWord(token, record.words[i], false)) return true;
    }
    const tagWords = record.tagWords || [];
    for (let i = 0; i < tagWords.length; i += 1) {
        if (tokenHitsWord(token, tagWords[i], true)) return true;
    }
    return false;
};

export function buildPhotoSearchIndex(library, infoByNumber, excluded) {
    const hidden = new Set((excluded || []).map(Number));
    return (library || []).flatMap((item) => {
        const number = item?.number;
        if (number == null || hidden.has(number)) return [];
        const info = infoByNumber?.[number] || {};
        const autoTags = automaticTagsFor(info);
        const jsonTags = Array.isArray(info.tags) ? info.tags : [];
        const tags = uniqueTags([...jsonTags, ...autoTags]);
        const fields = [
            info.title,
            info.year,
            info.details,
            info.description,
            ...tags,
        ];
        const haystack = fold(fields.filter(Boolean).join(' '));
        return [{
            number,
            item,
            tags,
            haystack,
            words: wordsOf(haystack),
            tagWords: wordsOf(tags.join(' ')),
        }];
    });
}

export function searchPhotos(index, query) {
    const tokens = wordsOf(query);
    if (!tokens.length) return [];
    return index.filter((record) => tokens.every((token) => tokenHitsRecord(token, record)));
}
