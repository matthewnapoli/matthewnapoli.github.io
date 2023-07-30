import matplotlib.pyplot as plt

colors = [
    '#FF0000',  # Red
    '#FF7F00',  # Orange
    '#FFFF00',  # Yellow
    '#00FF00',  # Green
    '#0000FF',  # Blue
    '#4B0082',  # Indigo
    '#9400D3',  # Violet
    '#FF1493',  # Pink
    '#00FFFF',  # Cyan
    '#FF4500'   # Orange-Red
]
# Create a subplot for each color
fig, axs = plt.subplots(1, len(colors), figsize=(15, 2))

# Draw rectangles of each color in the corresponding subplot
for i, color in enumerate(colors):
    axs[i].add_patch(plt.Rectangle((0, 0), 1, 1, color=color))
    axs[i].axis('off')

plt.show()
