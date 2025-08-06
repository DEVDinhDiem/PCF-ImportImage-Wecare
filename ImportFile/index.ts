import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface DataverseImageRecord {
    crdfd_multiimagesid: string;
    crdfd_image_name?: string;
    crdfd_notes?: string;
    crdfd_image?: string;
    crdfd_key_data?: string;
}

export class ImportFile implements ComponentFramework.StandardControl<IInputs, IOutputs> {
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
            imageItem.className = 'image-item';
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
    private clearAllImages(): void {
        this._selectedImages = [];
        this._imageNotes = [];
        this._fileName = "";
        this._fileContent = "";
        this._imagesList = "";
        this._imagesCount = 0;
        this.updateImageDisplay();
        this._notifyOutputChanged();
        this.updateStatus('Đã xóa tất cả hình ảnh', 'info');
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
            const query = `?$filter=crdfd_key_data eq '${this._keyDataValue}'&$select=crdfd_multiimagesid,crdfd_image_name,crdfd_notes,crdfd_image`;
            
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

        // Update count
        imageCount.textContent = `${this._imagesCount} hình ảnh`;

        if (this._imagesCount === 0) {
            previewContainer.classList.add('hidden');
            return;
        }

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
        const imageCount = this._container.querySelector('#imageCount') as HTMLSpanElement;
        
        // Update total count
        const totalCount = this._existingImages.length + this._selectedImages.length;
        imageCount.textContent = `${totalCount} hình ảnh (${this._existingImages.length} đã lưu, ${this._selectedImages.length} mới)`;

        // Add new images to grid
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
        this.displayExistingImages();
        this.updateStatus('Đã xóa hình ảnh chưa lưu', 'info');
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

        for (let i = 0; i < this._selectedImages.length; i++) {
            await this.saveImageToDataverse(i);
        }
    }
}
