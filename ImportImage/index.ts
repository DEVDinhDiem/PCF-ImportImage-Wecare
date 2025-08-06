import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface DataverseImageRecord {
    crdfd_multiimagesid: string;
    crdfd_image_name?: string;
    crdfd_notes?: string;
    crdfd_image?: string;
    crdfd_key_data?: string;
    crdfd_table?: string;
}

export class ImportImage implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _fileInput: HTMLInputElement;
    private _selectedImages: File[] = [];
    private _imageNotes: string[] = [];
    private _fileName = "";
    private _fileContent = "";
    private _uploadStatus = "";
    private _imagesList = "";
    private _imagesCount = 0;
    private _keyDataValue = "";
    private _existingImages: DataverseImageRecord[] = [];
    private _tableName = ""; // Store table name for crdfd_table field

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        
        this.createFileUploadInterface();
        this.setupEventListeners();
    }


    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        
        // Get key data value for filtering
        if (context.parameters.keyDataField && context.parameters.keyDataField.raw) {
            const newKeyDataValue = context.parameters.keyDataField.raw;
            
            // If key data changed, reload images
            if (this._keyDataValue !== newKeyDataValue) {
                this._keyDataValue = newKeyDataValue;
                
                // Try to extract table name from entity metadata or context
                this._tableName = this.getTableNameFromContext(context);
                
                this.loadExistingImages();
            }
        }
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    public getOutputs(): IOutputs {
        return {
            keyDataField: this._keyDataValue,
            fileName: this._fileName,
            fileContent: this._fileContent,
            uploadStatus: this._uploadStatus,
            imagesList: this._imagesList,
            imagesCount: this._imagesCount
        };
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void {
        if (this._fileInput) {
            this._fileInput.removeEventListener('change', this.onFileSelected.bind(this));
        }
    }

    /**
     * Creates the file upload interface
     */
    private createFileUploadInterface(): void {
        this._container.innerHTML = `
            <div class="import-file-container" id="dropZone" tabindex="0">
                <div class="file-icon">📂</div>
                <div class="upload-text">Chọn hoặc paste hình ảnh</div>
                <div class="upload-hint">Kéo thả hình vào đây, click để chọn nhiều hình, hoặc Ctrl+V để paste</div>
                <input type="file" id="fileInput" class="hidden" accept=".png,.jpg,.jpeg,.gif,.bmp,.webp" multiple>
                <div id="previewContainer" class="preview-container hidden">
                    <div class="preview-header">
                        <span id="imageCount">0 hình ảnh đã chọn</span>
                        <div class="action-buttons">
                            <button id="saveAll" class="save-all-button">💾 Lưu tất cả</button>
                            <button id="clearAll" class="clear-button">🗑️ Xóa tất cả</button>
                        </div>
                    </div>
                    <div id="imageGrid" class="image-grid"></div>
                </div>
                <div id="statusMessage" class="status-message hidden"></div>
            </div>
        `;

        this._fileInput = this._container.querySelector('#fileInput') as HTMLInputElement;
    }

    /**
     * Sets up event listeners for the file upload interface
     */
    private setupEventListeners(): void {
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;

        // Click to open file dialog
        dropZone.addEventListener('click', (e) => {
            // Don't open file dialog if clicking on buttons or interactive elements
            const target = e.target as HTMLElement;
            if (target.classList.contains('clear-button') || 
                target.classList.contains('save-all-button') ||
                target.classList.contains('save-image') ||
                target.classList.contains('image-item') || 
                target.classList.contains('remove-image') ||
                target.classList.contains('image-note') ||
                target.classList.contains('image-info') ||
                target.classList.contains('image-preview') ||
                target.classList.contains('image-name') ||
                target.classList.contains('image-size') ||
                target.classList.contains('action-buttons')) {
                return;
            }
            this._fileInput.click();
        });

        // File selection
        this._fileInput.addEventListener('change', this.onFileSelected.bind(this));

        // Drag and drop events
        dropZone.addEventListener('dragover', this.onDragOver.bind(this));
        dropZone.addEventListener('dragleave', this.onDragLeave.bind(this));
        dropZone.addEventListener('drop', this.onDrop.bind(this));

        // Paste events
        dropZone.addEventListener('paste', this.onPaste.bind(this));
        dropZone.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Focus to enable paste functionality
        dropZone.focus();

        // Clear all button
        const clearAllBtn = this._container.querySelector('#clearAll') as HTMLButtonElement;
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', this.clearAllImages.bind(this));
        }

        // Save all button
        const saveAllBtn = this._container.querySelector('#saveAll') as HTMLButtonElement;
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', this.saveAllImages.bind(this));
        }
    }

    /**
     * Handles file selection
     */
    private onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.addImages(Array.from(input.files));
        }
    }

    /**
     * Handles drag over event
     */
    private onDragOver(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.add('dragging');
    }

    /**
     * Handles drag leave event
     */
    private onDragLeave(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.remove('dragging');
    }

    /**
     * Handles drop event
     */
    private onDrop(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.remove('dragging');

        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            this.addImages(Array.from(event.dataTransfer.files));
        }
    }

    /**
     * Handles paste event for images from clipboard
     */
    private onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        
        if (!event.clipboardData) return;

        const items = Array.from(event.clipboardData.items);
        for (const item of items) {
            // Check if the item is an image
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    this.addImages([file]);
                    this.updateStatus('Hình ảnh đã được paste thành công', 'success');
                    return;
                }
            }
        }
        
        // If no image found in clipboard
        this.updateStatus('Không tìm thấy hình ảnh trong clipboard', 'error');
    }

    /**
     * Handles keyboard events
     */
    private onKeyDown(event: KeyboardEvent): void {
        // Focus back to container if user clicks elsewhere
        if (event.ctrlKey && event.key === 'v') {
            // Paste will be handled by onPaste event
            this.updateStatus('Đang kiểm tra clipboard...', 'info');
        }
    }

    /**
     * Adds images to the selection
     */
    private addImages(files: File[]): void {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.updateStatus('Vui lòng chỉ chọn các file hình ảnh', 'error');
            return;
        }

        // Add new images to existing selection
        this._selectedImages.push(...imageFiles);
        this.updateImageDisplay();
        this.processImages();
        
        const newCount = imageFiles.length;
        this.updateStatus(`Đã thêm ${newCount} hình ảnh`, 'success');
    }

    /**
     * Updates the image display grid
     */
    private updateImageDisplay(): void {
        // If we have existing images loaded, use the new display method
        if (this._existingImages.length > 0 || this._keyDataValue) {
            this.displayExistingImages();
            return;
        }

        // Fallback to original display for Canvas apps or when no key data
        const previewContainer = this._container.querySelector('#previewContainer') as HTMLDivElement;
        const imageGrid = this._container.querySelector('#imageGrid') as HTMLDivElement;
        const imageCount = this._container.querySelector('#imageCount') as HTMLSpanElement;

        // Update count
        this._imagesCount = this._selectedImages.length;
        imageCount.textContent = `${this._imagesCount} hình ảnh đã chọn`;

        if (this._imagesCount === 0) {
            previewContainer.classList.add('hidden');
            return;
        }

        previewContainer.classList.remove('hidden');
        imageGrid.innerHTML = '';

        // Create preview for each image
        this._selectedImages.forEach((file, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item new-image';
            imageItem.innerHTML = `
                <img src="" alt="Preview" class="image-preview">
                <div class="image-info">
                    <div class="image-name">${file.name || `Pasted_Image_${index + 1}.${this.getImageExtension(file.type)}`}</div>
                    <div class="image-size">${this.formatFileSize(file.size)}</div>
                    <textarea class="image-note" placeholder="Nhập ghi chú..." data-index="${index}"></textarea>
                </div>
                <button class="remove-image" data-index="${index}">×</button>
            `;

            // Create preview image
            const reader = new FileReader();
            const imgElement = imageItem.querySelector('.image-preview') as HTMLImageElement;
            reader.onload = (e) => {
                if (e.target && e.target.result) {
                    imgElement.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(file);

            // Add remove button event listener
            const removeBtn = imageItem.querySelector('.remove-image') as HTMLButtonElement;
            removeBtn.addEventListener('click', () => {
                this.removeImage(index);
            });

            // Add note textarea event listener
            const noteTextarea = imageItem.querySelector('.image-note') as HTMLTextAreaElement;
            noteTextarea.addEventListener('input', (e) => {
                const target = e.target as HTMLTextAreaElement;
                this.updateImageNote(index, target.value);
            });

            // Prevent event bubbling when clicking on textarea
            noteTextarea.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Load existing note if any
            const existingNote = this.getImageNote(index);
            if (existingNote) {
                noteTextarea.value = existingNote;
            }

            imageGrid.appendChild(imageItem);
        });
    }

    /**
     * Removes an image from selection
     */
    private removeImage(index: number): void {
        this._selectedImages.splice(index, 1);
        this._imageNotes.splice(index, 1); // Remove corresponding note
        this.updateImageDisplay();
        this.processImages();
        this.updateStatus('Đã xóa hình ảnh', 'info');
    }

    /**
     * Updates note for a specific image
     */
    private updateImageNote(index: number, note: string): void {
        // Ensure array is large enough
        while (this._imageNotes.length <= index) {
            this._imageNotes.push('');
        }
        this._imageNotes[index] = note;
        
        // Re-process images to update output with new note
        this.processImages();
    }

    /**
     * Gets note for a specific image
     */
    private getImageNote(index: number): string {
        return this._imageNotes[index] || '';
    }

    /**
     * Clears all selected images
     */
    private async clearAllImages(): Promise<void> {
        const hasNewImages = this._selectedImages.length > 0;
        const hasExistingImages = this._existingImages.length > 0;
        
        let confirmMessage = '';
        if (hasNewImages && hasExistingImages) {
            confirmMessage = `Bạn có chắc muốn xóa tất cả ${this._selectedImages.length} hình ảnh chưa lưu và ${this._existingImages.length} hình ảnh đã lưu trong Dataverse?`;
        } else if (hasNewImages) {
            confirmMessage = `Bạn có chắc muốn xóa tất cả ${this._selectedImages.length} hình ảnh chưa lưu?`;
        } else if (hasExistingImages) {
            confirmMessage = `Bạn có chắc muốn xóa tất cả ${this._existingImages.length} hình ảnh đã lưu trong Dataverse?`;
        } else {
            this.updateStatus('Không có hình ảnh nào để xóa', 'info');
            return;
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            this.updateStatus('Đang xóa tất cả hình ảnh...', 'info');

            // Delete all existing images from Dataverse
            if (hasExistingImages) {
                for (const image of this._existingImages) {
                    await this._context.webAPI.deleteRecord("crdfd_multiimages", image.crdfd_multiimagesid);
                }
            }

            // Clear local arrays
            this._selectedImages = [];
            this._imageNotes = [];
            this._existingImages = [];
            this._fileName = "";
            this._fileContent = "";
            this._imagesList = "";
            this._imagesCount = 0;
            
            // Hide preview container
            const previewContainer = this._container.querySelector('#previewContainer') as HTMLDivElement;
            previewContainer.classList.add('hidden');
            
            this._notifyOutputChanged();
            
            const deletedCount = (hasNewImages ? this._selectedImages.length : 0) + (hasExistingImages ? this._existingImages.length : 0);
            this.updateStatus(`Đã xóa thành công tất cả hình ảnh`, 'success');

        } catch (error) {
            console.error("Error clearing all images:", error);
            this.updateStatus('Lỗi khi xóa hình ảnh', 'error');
        }
    }

    /**
     * Processes all images and creates output data
     */
    private processImages(): void {
        if (this._selectedImages.length === 0) {
            this._fileName = "";
            this._fileContent = "";
            this._imagesList = "";
            this._imagesCount = 0;
            this._uploadStatus = "";
            this._notifyOutputChanged();
            return;
        }

        interface ImageData {
            name: string;
            content: string;
            size: number;
            type: string;
            index: number;
            note: string;
        }

        const imageData: ImageData[] = [];
        let processedCount = 0;

        this._selectedImages.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target && e.target.result) {
                    const base64String = (e.target.result as string).split(',')[1];
                    const fileName = file.name || `Pasted_Image_${index + 1}.${this.getImageExtension(file.type)}`;
                    
                    imageData.push({
                        name: fileName,
                        content: base64String,
                        size: file.size,
                        type: file.type,
                        index: index,
                        note: this.getImageNote(index)
                    });

                    processedCount++;
                    
                    // When all images are processed
                    if (processedCount === this._selectedImages.length) {
                        // Sort by index to maintain order
                        imageData.sort((a, b) => a.index - b.index);
                        
                        // Set output values
                        this._imagesList = JSON.stringify(imageData);
                        this._imagesCount = imageData.length;
                        
                        // Set first image as main file for backward compatibility
                        if (imageData.length > 0) {
                            this._fileName = imageData[0].name;
                            this._fileContent = imageData[0].content;
                        }
                        
                        this._uploadStatus = 'ready';
                        this._notifyOutputChanged();
                    }
                }
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Updates status message
     */
    private updateStatus(message: string, type: 'success' | 'error' | 'info'): void {
        const statusElement = this._container.querySelector('#statusMessage') as HTMLDivElement;
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.classList.remove('hidden');
    }

    /**
     * Formats file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Gets file extension based on MIME type for pasted images
     */
    private getImageExtension(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/bmp': 'bmp',
            'image/webp': 'webp',
            'image/svg+xml': 'svg'
        };
        return mimeToExt[mimeType] || 'png';
    }

    /**
     * Load existing images from crdfd_multiimages table
     */
    private async loadExistingImages(): Promise<void> {
        if (!this._keyDataValue || !this._context.webAPI) {
            return;
        }

        try {
            this.updateStatus('Đang tải hình ảnh có sẵn...', 'info');
            
            // Query crdfd_multiimages table
            const query = `?$filter=crdfd_key_data eq '${this._keyDataValue}'&$select=crdfd_multiimagesid,crdfd_image_name,crdfd_notes,crdfd_image,crdfd_table`;
            
            const result = await this._context.webAPI.retrieveMultipleRecords("crdfd_multiimages", query);
            
            this._existingImages = result.entities as DataverseImageRecord[];
            this._imagesCount = this._existingImages.length;
            
            // Update display with existing images
            this.displayExistingImages();
            
            this.updateStatus(`Đã tải ${this._imagesCount} hình ảnh`, 'success');
            
        } catch (error) {
            console.error("Error loading existing images:", error);
            this.updateStatus('Lỗi khi tải hình ảnh có sẵn', 'error');
        }
    }

    /**
     * Display existing images from Dataverse
     */
    private displayExistingImages(): void {
        const previewContainer = this._container.querySelector('#previewContainer') as HTMLDivElement;
        const imageGrid = this._container.querySelector('#imageGrid') as HTMLDivElement;
        const imageCount = this._container.querySelector('#imageCount') as HTMLSpanElement;

        // Calculate total count
        const totalCount = this._existingImages.length + this._selectedImages.length;
        this._imagesCount = totalCount;

        // Update count display
        if (totalCount === 0) {
            imageCount.textContent = `0 hình ảnh`;
            previewContainer.classList.add('hidden');
            return;
        }

        imageCount.textContent = `${totalCount} hình ảnh (${this._existingImages.length} đã lưu, ${this._selectedImages.length} mới)`;
        previewContainer.classList.remove('hidden');
        imageGrid.innerHTML = '';

        // Display existing images from Dataverse
        this._existingImages.forEach((record, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item existing-image';
            imageItem.innerHTML = `
                <img src="" alt="Preview" class="image-preview">
                <div class="image-info">
                    <div class="image-name">${record.crdfd_image_name || `Image_${index + 1}`}</div>
                    <div class="image-size">Đã lưu trong Dataverse</div>
                    <textarea class="image-note" placeholder="Nhập ghi chú..." data-existing-id="${record.crdfd_multiimagesid}">${record.crdfd_notes || ''}</textarea>
                </div>
                <button class="remove-image existing" data-existing-id="${record.crdfd_multiimagesid}">×</button>
            `;

            // Load image if available
            if (record.crdfd_image) {
                const imgElement = imageItem.querySelector('.image-preview') as HTMLImageElement;
                // For Dataverse images, we might need to make another call or use the image data directly
                this.loadDataverseImage(record.crdfd_multiimagesid, imgElement);
                
                // Add click handler to open full size image
                imgElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openImagePreview(record.crdfd_multiimagesid);
                });
                imgElement.style.cursor = 'pointer';
                
                // Set appropriate title based on environment
                if (this.isMobileEnvironment()) {
                    imgElement.title = 'Chạm để xem ảnh full size';
                } else {
                    imgElement.title = 'Click để xem ảnh full size';
                }
            }

            // Add remove button event listener for existing image
            const removeBtn = imageItem.querySelector('.remove-image') as HTMLButtonElement;
            removeBtn.addEventListener('click', () => {
                this.removeExistingImage(record.crdfd_multiimagesid, index);
            });

            // Add note textarea event listener for existing image
            const noteTextarea = imageItem.querySelector('.image-note') as HTMLTextAreaElement;
            noteTextarea.addEventListener('input', (e) => {
                const target = e.target as HTMLTextAreaElement;
                this.updateExistingImageNote(record.crdfd_multiimagesid, target.value);
            });

            // Prevent event bubbling
            noteTextarea.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            imageGrid.appendChild(imageItem);
        });

        // Display new selected images
        this.displayNewImages();
    }

    /**
     * Display newly selected images (not yet saved)
     */
    private displayNewImages(): void {
        const imageGrid = this._container.querySelector('#imageGrid') as HTMLDivElement;
        
        // Add new images to grid (count already updated in displayExistingImages)
        this._selectedImages.forEach((file, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item new-image';
            imageItem.innerHTML = `
                <img src="" alt="Preview" class="image-preview">
                <div class="image-info">
                    <div class="image-name">${file.name || `Pasted_Image_${index + 1}.${this.getImageExtension(file.type)}`}</div>
                    <div class="image-size">${this.formatFileSize(file.size)} - Chưa lưu</div>
                    <textarea class="image-note" placeholder="Nhập ghi chú..." data-index="${index}"></textarea>
                </div>
                <button class="remove-image new" data-index="${index}">×</button>
                <button class="save-image" data-index="${index}">💾 Lưu</button>
            `;

            // Create preview image
            const reader = new FileReader();
            const imgElement = imageItem.querySelector('.image-preview') as HTMLImageElement;
            reader.onload = (e) => {
                if (e.target && e.target.result) {
                    imgElement.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(file);

            // Add remove button event listener
            const removeBtn = imageItem.querySelector('.remove-image') as HTMLButtonElement;
            removeBtn.addEventListener('click', () => {
                this.removeNewImage(index);
            });

            // Add save button event listener  
            const saveBtn = imageItem.querySelector('.save-image') as HTMLButtonElement;
            saveBtn.addEventListener('click', () => {
                this.saveImageToDataverse(index);
            });

            // Add note textarea event listener
            const noteTextarea = imageItem.querySelector('.image-note') as HTMLTextAreaElement;
            noteTextarea.addEventListener('input', (e) => {
                const target = e.target as HTMLTextAreaElement;
                this.updateImageNote(index, target.value);
            });

            // Prevent event bubbling
            noteTextarea.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Load existing note if any
            const existingNote = this.getImageNote(index);
            if (existingNote) {
                noteTextarea.value = existingNote;
            }

            imageGrid.appendChild(imageItem);
        });
    }

    /**
     * Load image from Dataverse
     */
    private async loadDataverseImage(imageId: string, imgElement: HTMLImageElement): Promise<void> {
        try {
            // For Dataverse images, we might need to use the File API or make a specific call
            // This is a placeholder - actual implementation depends on how images are stored
            const response = await this._context.webAPI.retrieveRecord("crdfd_multiimages", imageId, "?$select=crdfd_image");
            if (response.crdfd_image) {
                imgElement.src = `data:image/png;base64,${response.crdfd_image}`;
            }
        } catch (error) {
            console.error("Error loading Dataverse image:", error);
            // Set a placeholder or default image
            imgElement.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+";
        }
    }

    /**
     * Save a new image to Dataverse
     */
    private async saveImageToDataverse(index: number): Promise<void> {
        if (!this._keyDataValue || !this._context.webAPI) {
            this.updateStatus('Không có key data để lưu', 'error');
            return;
        }

        const file = this._selectedImages[index];
        if (!file) {
            return;
        }

        try {
            this.updateStatus('Đang lưu hình ảnh...', 'info');

            // Convert image to base64
            const base64String = await this.fileToBase64(file);
            const note = this.getImageNote(index);
            const fileName = file.name || `Image_${Date.now()}.${this.getImageExtension(file.type)}`;

            // Create record in crdfd_multiimages
            const record = {
                crdfd_image_name: fileName,
                crdfd_notes: note,
                crdfd_key_data: this._keyDataValue,
                crdfd_table: this._tableName,
                crdfd_image: base64String.split(',')[1] // Remove data:image prefix
            };

            const result = await this._context.webAPI.createRecord("crdfd_multiimages", record);

            // Remove from selected images and add to existing
            this._selectedImages.splice(index, 1);
            this._imageNotes.splice(index, 1);

            // Reload existing images
            await this.loadExistingImages();

            this.updateStatus('Đã lưu hình ảnh thành công', 'success');

        } catch (error) {
            console.error("Error saving image to Dataverse:", error);
            this.updateStatus('Lỗi khi lưu hình ảnh', 'error');
        }
    }

    /**
     * Remove existing image from Dataverse
     */
    private async removeExistingImage(imageId: string, index: number): Promise<void> {
        if (!confirm('Bạn có chắc muốn xóa hình ảnh này khỏi Dataverse?')) {
            return;
        }

        try {
            this.updateStatus('Đang xóa hình ảnh...', 'info');

            await this._context.webAPI.deleteRecord("crdfd_multiimages", imageId);

            // Remove from existing images array
            this._existingImages.splice(index, 1);
            this._imagesCount = this._existingImages.length + this._selectedImages.length;

            // Update display
            this.displayExistingImages();

            this.updateStatus('Đã xóa hình ảnh', 'success');

        } catch (error) {
            console.error("Error removing existing image:", error);
            this.updateStatus('Lỗi khi xóa hình ảnh', 'error');
        }
    }

    /**
     * Update note for existing image in Dataverse
     */
    private async updateExistingImageNote(imageId: string, note: string): Promise<void> {
        try {
            const record = {
                crdfd_notes: note
            };

            await this._context.webAPI.updateRecord("crdfd_multiimages", imageId, record);

            // Update local data
            const existingImage = this._existingImages.find(img => img.crdfd_multiimagesid === imageId);
            if (existingImage) {
                existingImage.crdfd_notes = note;
            }

        } catch (error) {
            console.error("Error updating note:", error);
            this.updateStatus('Lỗi khi cập nhật ghi chú', 'error');
        }
    }

    /**
     * Remove new image (not yet saved)
     */
    private removeNewImage(index: number): void {
        this._selectedImages.splice(index, 1);
        this._imageNotes.splice(index, 1);
        
        // Refresh display
        if (this._existingImages.length > 0 || this._keyDataValue) {
            this.displayExistingImages();
        } else {
            this.updateImageDisplay();
        }
        
        this.updateStatus('Đã xóa hình ảnh chưa lưu', 'info');
    }

    /**
     * Opens image preview in new window
     */
    private openImagePreview(imageId: string): void {
        // Check if running in mobile environment
        if (this.isMobileEnvironment()) {
            // For mobile, create an overlay modal to display the image
            this.showImageModal(imageId);
        } else {
            // For web, use the original method
            const baseUrl = this.getEnvironmentBaseUrl();
            const timestamp = Date.now();
            
            // Construct the image download URL
            const imageUrl = `${baseUrl}/Image/download.aspx?Entity=crdfd_multiimages&Attribute=crdfd_image&Id=${imageId}&Timestamp=${timestamp}&Full=true`;
            
            // Open in new window/tab
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Check if running in mobile environment
     */
    private isMobileEnvironment(): boolean {
        try {
            // Check if it's Power Apps mobile
            if (typeof window !== 'undefined') {
                const userAgent = window.navigator.userAgent.toLowerCase();
                
                // Check for Power Apps mobile indicators
                if (userAgent.includes('powerapps') || 
                    userAgent.includes('mobile') ||
                    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
                    return true;
                }
                
                // Check for small screen size (mobile indicator)
                if (window.innerWidth <= 768) {
                    return true;
                }
                
                // Check for touch device
                if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                    return true;
                }
                
                // Check for Power Apps specific context
                if (window.location && window.location.href.includes('apps.powerapps.com')) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn('Could not determine mobile environment:', error);
            // Default to mobile-friendly approach if cannot determine
            return true;
        }
    }

    /**
     * Show image in modal overlay for mobile
     */
    private async showImageModal(imageId: string): Promise<void> {
        try {
            // Remove any existing modal
            this.removeImageModal();
            
            this.updateStatus('Đang chuẩn bị hiển thị ảnh...', 'info');
            
            // Get only the image name for the modal title
            const response = await this._context.webAPI.retrieveRecord("crdfd_multiimages", imageId, "?$select=crdfd_image_name,crdfd_image");
            
            // Construct the full size image URL for display and download
            const baseUrl = this.getEnvironmentBaseUrl();
            const timestamp = Date.now();
            const fullImageUrl = `${baseUrl}/Image/download.aspx?Entity=crdfd_multiimages&Attribute=crdfd_image&Id=${imageId}&Timestamp=${timestamp}&Full=true`;

            // Create modal overlay
            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'imageModal';
            modalOverlay.className = 'image-modal-overlay';

            modalOverlay.innerHTML = `
                <div class="image-modal-content">
                    <div class="image-modal-header">
                        <span class="image-modal-title">${response.crdfd_image_name || 'Hình ảnh'}</span>
                        <button class="image-modal-close">×</button>
                    </div>
                    <div class="image-modal-body">
                        <img src="${fullImageUrl}" alt="Full size image" class="image-modal-img" crossorigin="anonymous">
                        <div class="image-loading">Đang tải ảnh full size...</div>
                        <div class="zoom-instructions">
                            ${this.isMobileEnvironment() ? 
                                'Pinch để zoom • Kéo để xem các góc • Double-tap để reset' : 
                                'Scroll để zoom • Kéo để xem các góc • Double-click để reset'
                            }
                        </div>
                    </div>
                    <div class="image-modal-footer">
                        <button class="image-modal-download">📥 Tải về</button>
                        <button class="image-modal-close-btn">Đóng</button>
                    </div>
                </div>
            `;
            
            // Add to document
            document.body.appendChild(modalOverlay);
            
            // Add event listeners
            const closeBtn = modalOverlay.querySelector('.image-modal-close') as HTMLButtonElement;
            const closeBtnFooter = modalOverlay.querySelector('.image-modal-close-btn') as HTMLButtonElement;
            const downloadBtn = modalOverlay.querySelector('.image-modal-download') as HTMLButtonElement;
            const img = modalOverlay.querySelector('.image-modal-img') as HTMLImageElement;
            const loadingDiv = modalOverlay.querySelector('.image-loading') as HTMLDivElement;
            
            // Close modal handlers
            const closeModal = () => {
                this.removeImageModal();
            };
            
            closeBtn.addEventListener('click', closeModal);
            closeBtnFooter.addEventListener('click', closeModal);
            
            // Close when clicking outside
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            });
            
            // Image load handlers
            img.addEventListener('load', () => {
                loadingDiv.style.display = 'none';
                img.style.display = 'block';
                
                // Show zoom instructions after image loads
                const instructions = modalOverlay.querySelector('.zoom-instructions') as HTMLDivElement;
                if (instructions) {
                    setTimeout(() => {
                        instructions.style.opacity = '1';
                        setTimeout(() => {
                            instructions.style.opacity = '0';
                        }, 3000); // Hide after 3 seconds
                    }, 500);
                }
                
                // Auto-fit image to modal size on load
                this.autoFitImage(img);
                
                if (this.isMobileEnvironment()) {
                    this.updateStatus('Ảnh full size đã tải. Pinch để zoom, kéo để xem các góc', 'success');
                } else {
                    this.updateStatus('Ảnh full size đã được tải. Scroll để zoom, kéo để xem các góc', 'success');
                }
            });
            
            img.addEventListener('error', () => {
                loadingDiv.textContent = 'Không thể tải ảnh full size. Đang hiển thị ảnh preview...';
                // Fallback to base64 if web link fails and we have it
                if (response.crdfd_image) {
                    img.src = `data:image/png;base64,${response.crdfd_image}`;
                    img.style.display = 'block';
                    loadingDiv.style.display = 'none';
                    this.updateStatus('Hiển thị ảnh preview', 'info');
                } else {
                    this.updateStatus('Không thể tải ảnh', 'error');
                }
            });
            
            // Download handler - use the full size web URL
            downloadBtn.addEventListener('click', () => {
                this.downloadImageFromUrl(fullImageUrl, response.crdfd_image_name || 'image.png');
            });
            
            // Pinch to zoom support for mobile
            this.addPinchToZoom(img);
            
            this.updateStatus('Ảnh đã được hiển thị', 'success');
            
        } catch (error) {
            console.error('Error showing image modal:', error);
            this.updateStatus('Lỗi khi hiển thị ảnh', 'error');
        }
    }

    /**
     * Remove image modal
     */
    private removeImageModal(): void {
        const existingModal = document.getElementById('imageModal');
        if (existingModal) {
            existingModal.remove();
        }
    }

    /**
     * Download image from URL (for full size images)
     */
    private downloadImageFromUrl(imageUrl: string, fileName: string): void {
        try {
            if (this.isMobileEnvironment()) {
                // For mobile, open in new tab/window - the browser will handle download
                window.open(imageUrl, '_blank', 'noopener,noreferrer');
                this.updateStatus('Đã mở ảnh full size trong tab mới', 'success');
            } else {
                // For desktop, create download link
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = fileName;
                link.target = '_blank';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.updateStatus('Đang tải ảnh full size...', 'success');
            }
        } catch (error) {
            console.error('Error downloading image:', error);
            this.updateStatus('Lỗi khi tải ảnh', 'error');
        }
    }

    /**
     * Download image from base64 data (fallback method)
     */
    private downloadImageFromBase64(base64Data: string, fileName: string): void {
        try {
            // Create download link
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${base64Data}`;
            link.download = fileName;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.updateStatus('Đã tải ảnh xuống (preview size)', 'success');
        } catch (error) {
            console.error('Error downloading image:', error);
            this.updateStatus('Lỗi khi tải ảnh', 'error');
        }
    }

    /**
     * Add pinch to zoom functionality for mobile with smart zoom levels
     */
    private addPinchToZoom(imgElement: HTMLImageElement): void {
        let scale = 1;
        let startDistance = 0;
        let initialScale = 1;
        let translateX = 0;
        let translateY = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let isPanning = false;
        let isZooming = false;
        
        // Predefined smart zoom levels for mobile
        const ZOOM_LEVELS = [0.3, 0.5, 1.0, 1.5, 2.0, 3.0];
        
        // Get initial scale from the element (from autoFit)
        const computedStyle = window.getComputedStyle(imgElement);
        const matrix = computedStyle.transform;
        if (matrix && matrix !== 'none') {
            const matrixMatch = matrix.match(/matrix\(([^)]+)\)/);
            if (matrixMatch) {
                const values = matrixMatch[1].split(',').map(parseFloat);
                scale = values[0]; // First value is scaleX
            }
        }
        
        // Set initial styles for better transform handling
        imgElement.style.transformOrigin = 'center center';
        imgElement.style.transition = 'transform 0.3s ease-out';
        
        imgElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // Two finger pinch to zoom
                startDistance = this.getDistance(e.touches[0], e.touches[1]);
                initialScale = scale;
                isZooming = true;
                imgElement.style.transition = 'none'; // Disable transition during pinch
            } else if (e.touches.length === 1) {
                // Single finger - allow panning at any scale
                isPanning = true;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
                imgElement.style.transition = 'none'; // Disable transition during pan
            }
        });
        
        imgElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2 && isZooming) {
                // Pinch zoom with smooth scaling
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scaleChange = currentDistance / startDistance;
                const newScale = initialScale * scaleChange;
                
                // Smooth zoom bounds - allow more granular control
                scale = Math.min(Math.max(0.2, newScale), 4);
                
                this.updateImageTransform(imgElement, scale, translateX, translateY);
            } else if (e.touches.length === 1 && isPanning && !isZooming) {
                // Pan image - allow at any zoom level
                const deltaX = e.touches[0].clientX - lastTouchX;
                const deltaY = e.touches[0].clientY - lastTouchY;
                
                // More generous pan bounds
                const maxTranslateX = Math.max(0, (scale - 0.3) * imgElement.clientWidth / 2);
                const maxTranslateY = Math.max(0, (scale - 0.3) * imgElement.clientHeight / 2);
                
                translateX = Math.min(Math.max(translateX + deltaX, -maxTranslateX), maxTranslateX);
                translateY = Math.min(Math.max(translateY + deltaY, -maxTranslateY), maxTranslateY);
                
                this.updateImageTransform(imgElement, scale, translateX, translateY);
                
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        });
        
        // Smart double tap with predefined zoom levels
        let lastTouchEnd = 0;
        let tapTimeout: NodeJS.Timeout | null = null;
        
        imgElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            isPanning = false;
            isZooming = false;
            
            // Re-enable smooth transition after touch ends
            setTimeout(() => {
                imgElement.style.transition = 'transform 0.3s ease-out';
            }, 100);
            
            const now = Date.now();
            
            if (tapTimeout) {
                clearTimeout(tapTimeout);
                tapTimeout = null;
            }
            
            if (now - lastTouchEnd <= 300) {
                // Smart double tap cycling through zoom levels
                const currentIndex = this.getClosestZoomIndex(scale);
                let nextIndex = currentIndex + 1;
                
                // Cycle back to start if at end
                if (nextIndex >= ZOOM_LEVELS.length) {
                    nextIndex = 0;
                }
                
                scale = ZOOM_LEVELS[nextIndex];
                
                // Reset position for extreme zoom levels
                if (scale <= 0.5 || scale >= 2) {
                    translateX = 0;
                    translateY = 0;
                }
                
                imgElement.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                this.updateImageTransform(imgElement, scale, translateX, translateY);
            } else {
                // Single tap - set timeout to handle it if no second tap comes
                tapTimeout = setTimeout(() => {
                    tapTimeout = null;
                }, 300);
            }
            
            lastTouchEnd = now;
        });
        
        // Handle gestures ending
        imgElement.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            isPanning = false;
            isZooming = false;
            imgElement.style.transition = 'transform 0.3s ease-out';
        });
        
        // Enhanced wheel zoom for desktop - smooth zoom without snapping
        imgElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            const newScale = scale + delta;
            
            // Smooth zoom without snapping - allow free zoom between bounds
            scale = Math.min(Math.max(0.2, newScale), 4);
            
            // Reset position for very small or large scales
            if (scale <= 0.5 || scale >= 3) {
                translateX = 0;
                translateY = 0;
            }
            
            this.updateImageTransform(imgElement, scale, translateX, translateY);
        });
        
        // Enhanced mouse drag support for desktop
        let isMouseDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        
        imgElement.addEventListener('mousedown', (e) => {
            // Allow panning at any scale level
            e.preventDefault();
            isMouseDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            imgElement.style.cursor = 'grabbing';
            imgElement.style.transition = 'none';
        });
        
        imgElement.addEventListener('mousemove', (e) => {
            if (isMouseDragging) {
                e.preventDefault();
                
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;
                
                // Generous pan bounds
                const maxTranslateX = Math.max(0, (scale - 0.3) * imgElement.clientWidth / 2);
                const maxTranslateY = Math.max(0, (scale - 0.3) * imgElement.clientHeight / 2);
                
                translateX = Math.min(Math.max(translateX + deltaX, -maxTranslateX), maxTranslateX);
                translateY = Math.min(Math.max(translateY + deltaY, -maxTranslateY), maxTranslateY);
                
                this.updateImageTransform(imgElement, scale, translateX, translateY);
                
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });
        
        imgElement.addEventListener('mouseup', (e) => {
            if (isMouseDragging) {
                e.preventDefault();
                isMouseDragging = false;
                imgElement.style.cursor = 'grab';
                imgElement.style.transition = 'transform 0.3s ease-out';
            }
        });
        
        imgElement.addEventListener('mouseleave', (e) => {
            if (isMouseDragging) {
                isMouseDragging = false;
                imgElement.style.cursor = 'grab';
                imgElement.style.transition = 'transform 0.3s ease-out';
            }
        });
        
        // Smart double click for desktop
        imgElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            
            // Cycle through common zoom levels
            const currentIndex = this.getClosestZoomIndex(scale);
            let nextIndex = currentIndex + 1;
            
            if (nextIndex >= ZOOM_LEVELS.length) {
                nextIndex = 0;
            }
            
            scale = ZOOM_LEVELS[nextIndex];
            
            // Reset position for extreme zooms
            if (scale <= 0.5 || scale >= 2) {
                translateX = 0;
                translateY = 0;
            }
            
            imgElement.style.cursor = 'grab';
            imgElement.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            this.updateImageTransform(imgElement, scale, translateX, translateY);
        });
    }
    
    /**
     * Get smart zoom level - snaps to predefined levels
     */
    private getSmartZoomLevel(currentScale: number): number {
        const ZOOM_LEVELS = [0.3, 0.5, 1.0, 1.5, 2.0, 3.0];
        
        // Find closest zoom level
        let closest = ZOOM_LEVELS[0];
        let minDiff = Math.abs(currentScale - closest);
        
        for (const level of ZOOM_LEVELS) {
            const diff = Math.abs(currentScale - level);
            if (diff < minDiff) {
                minDiff = diff;
                closest = level;
            }
        }
        
        return closest;
    }
    
    /**
     * Get closest zoom index for cycling
     */
    private getClosestZoomIndex(currentScale: number): number {
        const ZOOM_LEVELS = [0.3, 0.5, 1.0, 1.5, 2.0, 3.0];
        
        let closestIndex = 0;
        let minDiff = Math.abs(currentScale - ZOOM_LEVELS[0]);
        
        for (let i = 1; i < ZOOM_LEVELS.length; i++) {
            const diff = Math.abs(currentScale - ZOOM_LEVELS[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        return closestIndex;
    }
    
    /**
     * Auto-fit image to modal size on load with smart sizing
     */
    private autoFitImage(imgElement: HTMLImageElement): void {
        const modalBody = imgElement.closest('.image-modal-body') as HTMLElement;
        if (!modalBody) return;
        
        const bodyWidth = modalBody.clientWidth;
        const bodyHeight = modalBody.clientHeight;
        
        // Get natural image dimensions
        const imgWidth = imgElement.naturalWidth;
        const imgHeight = imgElement.naturalHeight;
        
        if (imgWidth && imgHeight) {
            // Calculate scale to fit image optimally in the modal
            const scaleX = bodyWidth / imgWidth;
            const scaleY = bodyHeight / imgHeight;
            const fitScale = Math.min(scaleX, scaleY);
            
            // Smart auto-fit: Tối thiểu 100% size (1.0) để ảnh không quá nhỏ
            // Nếu ảnh nhỏ hơn modal thì để nguyên size (1.0)
            // Nếu ảnh lớn hơn modal thì scale xuống vừa khít
            const optimalScale = Math.max(fitScale, 1.0);
            
            // Set initial transform with smart fit
            imgElement.style.transform = `scale(${optimalScale})`;
            imgElement.style.transformOrigin = 'center center';
            
            // Always show cursor as grab since user can zoom
            imgElement.style.cursor = 'grab';
        }
    }

    /**
     * Update image transform with scale and translation - enhanced with better feedback
     */
    private updateImageTransform(imgElement: HTMLImageElement, scale: number, translateX: number, translateY: number): void {
        imgElement.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
        
        // Show zoom level indicator with better styling
        this.showZoomIndicator(imgElement, scale);
        
        // Update cursor based on zoom level
        if (scale <= 0.5) {
            imgElement.style.cursor = 'zoom-in';
        } else if (scale >= 2.5) {
            imgElement.style.cursor = 'zoom-out';
        } else {
            imgElement.style.cursor = 'grab';
        }
    }
    
    /**
     * Show zoom level indicator temporarily with enhanced styling
     */
    private showZoomIndicator(imgElement: HTMLImageElement, scale: number): void {
        // Remove existing indicator
        const existingIndicator = document.querySelector('.zoom-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create enhanced zoom indicator
        const indicator = document.createElement('div');
        indicator.className = 'zoom-indicator';
        
        // Add scale percentage and visual feedback
        const percentage = Math.round(scale * 100);
        let scaleText = `${percentage}%`;
        let scaleClass = '';
        
        // Add contextual labels
        if (scale <= 0.5) {
            scaleClass = 'zoom-small';
            scaleText += ' 🔍-';
        } else if (scale >= 2.5) {
            scaleClass = 'zoom-large';
            scaleText += ' 🔍+';
        } else if (Math.abs(scale - 1) < 0.1) {
            scaleClass = 'zoom-normal';
            scaleText = '100% ✓';
        }
        
        indicator.textContent = scaleText;
        indicator.classList.add(scaleClass);
        
        // Add to modal body with better positioning
        const modalBody = imgElement.closest('.image-modal-body');
        if (modalBody) {
            modalBody.appendChild(indicator);
            
            // Animate in
            indicator.style.opacity = '1';
            indicator.style.transform = 'scale(1)';
            
            // Auto hide with smooth fade
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0';
                    indicator.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.remove();
                        }
                    }, 300);
                }
            }, 1800);
        }
    }

    /**
     * Get distance between two touch points
     */
    private getDistance(touch1: Touch, touch2: Touch): number {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Gets table name from context
     */
    private getTableNameFromContext(context: ComponentFramework.Context<IInputs>): string {
        try {
            // Try to extract from URL
            if (typeof window !== 'undefined' && window.location && window.location.href) {
                const url = window.location.href;
                // Pattern to match entity name in Dynamics URL
                const match = url.match(/etn=([^&]+)/);
                if (match && match[1]) {
                    return match[1];
                }
                
                // Alternative pattern for different URL formats
                const pathMatch = url.match(/\/main\.aspx.*[?&]etn=([^&]+)/);
                if (pathMatch && pathMatch[1]) {
                    return pathMatch[1];
                }
            }
            
            // Default fallback
            return 'unknown_table';
        } catch (error) {
            console.warn('Could not determine table name:', error);
            return 'unknown_table';
        }
    }

    /**
     * Gets the environment base URL
     */
    private getEnvironmentBaseUrl(): string {
        try {
            // Fallback: extract from current window location
            if (typeof window !== 'undefined' && window.location) {
                const { protocol, hostname } = window.location;
                return `${protocol}//${hostname}`;
            }
            
            // Default fallback
            return 'https://wecare-ii.crm5.dynamics.com';
        } catch (error) {
            console.warn('Could not determine base URL, using default:', error);
            return 'https://wecare-ii.crm5.dynamics.com';
        }
    }

    /**
     * Convert File to base64 string
     */
    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Add save all button functionality
     */
    private async saveAllImages(): Promise<void> {
        if (this._selectedImages.length === 0) {
            this.updateStatus('Không có hình ảnh mới để lưu', 'info');
            return;
        }

        this.updateStatus(`Đang lưu ${this._selectedImages.length} hình ảnh...`, 'info');

        try {
            // Save all images sequentially
            const imagesToSave = [...this._selectedImages]; // Create a copy to avoid array mutation issues
            
            for (let i = 0; i < imagesToSave.length; i++) {
                const file = imagesToSave[i];
                const note = this.getImageNote(i);
                const fileName = file.name || `Image_${Date.now()}_${i}.${this.getImageExtension(file.type)}`;

                // Convert image to base64
                const base64String = await this.fileToBase64(file);

                // Create record in crdfd_multiimages
                const record = {
                    crdfd_image_name: fileName,
                    crdfd_notes: note,
                    crdfd_key_data: this._keyDataValue,
                    crdfd_table: this._tableName,
                    crdfd_image: base64String.split(',')[1] // Remove data:image prefix
                };

                await this._context.webAPI.createRecord("crdfd_multiimages", record);
                
                this.updateStatus(`Đã lưu ${i + 1}/${imagesToSave.length} hình ảnh...`, 'info');
            }

            // Clear selected images and notes after successful save
            this._selectedImages = [];
            this._imageNotes = [];

            // Reload existing images
            await this.loadExistingImages();

            this.updateStatus(`Đã lưu thành công ${imagesToSave.length} hình ảnh`, 'success');

        } catch (error) {
            console.error("Error saving all images:", error);
            this.updateStatus('Lỗi khi lưu hình ảnh', 'error');
        }
    }
}
