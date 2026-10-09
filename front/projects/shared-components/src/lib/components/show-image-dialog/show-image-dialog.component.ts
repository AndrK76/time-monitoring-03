import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ShowImageDialogData {
  url: string;
  title: string;
  greenRectangles?: ShowImageRectangle[];
}
export interface ShowImageRectangle {
  left: number;    // 0..1
  top: number;     // 0..1
  width: number;   // 0..1
  height: number;  // 0..1
}

@Component({
  selector: 'sc-show-image-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './show-image-dialog.component.html',
  styleUrl: './show-image-dialog.component.scss'
})
export class ShowImageDialogComponent implements AfterViewInit {
  data = inject<ShowImageDialogData>(MAT_DIALOG_DATA);
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>

  ngAfterViewInit(): void {
    const img = new Image();
    img.onload = () => this.draw(img);
    img.src = this.data.url;
  }

  private draw(img: HTMLImageElement): void {
    const drawGreenRectangle = (ctx: CanvasRenderingContext2D, rectangle: ShowImageRectangle) => {
      const z = rectangle;
      if (!z) return;
      const x = z.left * canvas.width;
      const y = z.top * canvas.height;
      const w = z.width * canvas.width;
      const h = z.height * canvas.height;

      ctx.strokeStyle = '#00c853';   // зелёный
      ctx.lineWidth = Math.max(4, canvas.width / 400);
      ctx.strokeRect(x, y, w, h);

    }

    const canvas = this.canvasRef.nativeElement;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    this?.data.greenRectangles?.forEach(z => drawGreenRectangle(ctx, z));
  }

}
