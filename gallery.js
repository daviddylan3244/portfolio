document.addEventListener('DOMContentLoaded', () => {
    console.log('Script is running');
    
    const photoGrid = document.querySelector('.photo-grid');
    if (!photoGrid) {
        console.error('Could not find photo-grid element');
        return;
    }

    // For React/CRA environment, images should be referenced from the public folder
    const photos = Array.from({length: 7}, (_, i) => `/graffiti/${i + 1}.png`);
    
    photos.forEach(photoPath => {
        console.log('Creating image for:', photoPath);
        const img = document.createElement('img');
        img.src = photoPath;
        img.alt = 'Graffiti artwork';
        photoGrid.appendChild(img);
    });
}); 